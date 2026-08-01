package authservice.service;

import authservice.dto.request.ActivateAccountRequest;
import authservice.dto.request.CreateAccountRequest;
import authservice.dto.request.UpdateAccountRequest;
import authservice.dto.response.AccountResponse;
import authservice.dto.response.PageResponse;
import authservice.dto.response.InternalAccountResponse;
import authservice.dto.response.AccountStatsResponse;
import authservice.entity.Account;
import authservice.entity.PasswordReset;
import authservice.entity.Role;
import authservice.enums.AccountStatus;
import authservice.event.AccountActivationRequestedEvent;
import authservice.event.UserRegisteredEvent;
import authservice.event.AccountStatusChangedEvent;
import authservice.exception.AuthErrorCode;
import authservice.mapper.AccountMapper;
import authservice.messaging.AuthEventPublisher;
import authservice.repository.AccountRepository;
import authservice.repository.AuthTokenRepository;
import authservice.repository.PasswordResetRepository;
import authservice.repository.RoleRepository;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AccountService {

    AccountRepository accountRepository;
    AuthTokenRepository authTokenRepository;
    AccountMapper accountMapper;
    PasswordEncoder passwordEncoder;
    RoleRepository roleRepository;
    PasswordResetRepository passwordResetRepository;
    AuthEventPublisher authEventPublisher;
    AuditLogService auditLogService;

    private static final Pattern DIACRITICS = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");

    @NonFinal
    @Value("${auth.activation.ttl-hours}")
    long activationTtlHours;

    @NonFinal
    @Value("${app.frontend-url}")
    String frontendUrl;

    public List<AccountResponse> getAllAccount() {
        return accountMapper.toAccountResponseList(accountRepository.findAll());
    }

    public PageResponse<AccountResponse> searchAccounts(
            String query, AccountStatus status, String role, int page, int size) {
        if (page < 1 || size < 1 || size > 100) {
            throw new AppException(AuthErrorCode.INVALID_PAGE_REQUEST);
        }

        Specification<Account> specification = Specification.where(null);
        if (StringUtils.hasText(query)) {
            String pattern = "%" + query.trim().toLowerCase() + "%";
            specification = specification.and((root, ignored, cb) -> cb.or(
                    cb.like(cb.lower(root.get("username")), pattern),
                    cb.like(cb.lower(root.get("email")), pattern)
            ));
        }
        if (status != null) {
            specification = specification.and((root, ignored, cb) -> cb.equal(root.get("status"), status));
        }
        if (StringUtils.hasText(role)) {
            String normalizedRole = role.trim().toUpperCase();
            specification = specification.and((root, querySpec, cb) -> {
                querySpec.distinct(true);
                return cb.equal(root.join("roles").get("roleName"), normalizedRole);
            });
        }

        Page<Account> result = accountRepository.findAll(specification, PageRequest.of(page - 1, size));
        return PageResponse.<AccountResponse>builder()
                .currentPage(page)
                .totalPages(result.getTotalPages())
                .pageSize(result.getSize())
                .totalElements(result.getTotalElements())
                .data(result.getContent().stream().map(accountMapper::toAccountResponse).toList())
                .build();
    }

    public AccountStatsResponse getAccountStats() {
        LocalDateTime monthStart = LocalDateTime.now().withDayOfMonth(1).toLocalDate().atStartOfDay();
        return AccountStatsResponse.builder()
                .total(accountRepository.count())
                .active(accountRepository.countByStatus(AccountStatus.ACTIVE))
                .pending(accountRepository.countByStatus(AccountStatus.PENDING))
                .inactive(accountRepository.countByStatus(AccountStatus.INACTIVE))
                .employees(accountRepository.countByRole("EMPLOYEE"))
                .newThisMonth(accountRepository.countByCreatedAtGreaterThanEqual(monthStart))
                .build();
    }

    public AccountResponse getAccountById(String accountId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new AppException(AuthErrorCode.ACCOUNT_NOT_FOUND));
        return accountMapper.toAccountResponse(account);
    }

    public InternalAccountResponse getInternalAccount(String accountId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new AppException(AuthErrorCode.ACCOUNT_NOT_FOUND));
        return InternalAccountResponse.builder()
                .accountId(account.getAccountId())
                .email(account.getEmail())
                .status(account.getStatus().name())
                .roles(account.getRoles().stream().map(Role::getRoleName).collect(java.util.stream.Collectors.toSet()))
                .build();
    }

    @Transactional
    public void updateInternalStatus(String accountId, AccountStatus status) {
        updateAccount(accountId, UpdateAccountRequest.builder().status(status).build());
    }

    @Transactional
    public AccountResponse updateAccount(String accountId, UpdateAccountRequest request) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new AppException(AuthErrorCode.ACCOUNT_NOT_FOUND));

        String oldRoles = account.getRoles() != null ? account.getRoles().toString() : null;

        // Update auth fields owned by auth-service
        if (StringUtils.hasText(request.getEmail())) {
            account.setEmail(request.getEmail().trim().toLowerCase());
        }

        if (StringUtils.hasText(request.getPassword())) {
            account.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }

        if (!CollectionUtils.isEmpty(request.getRoles())) {
            List<Role> roles = roleRepository.findAllById(request.getRoles());
            if (roles.size() != request.getRoles().stream().distinct().count()) {
                throw new AppException(AuthErrorCode.ROLE_NOT_FOUND);
            }
            account.setRoles(new HashSet<>(roles));
        }

        AccountStatus previousStatus = account.getStatus();
        if (request.getStatus() != null) {
            account.setStatus(request.getStatus());
        }

        accountRepository.save(account);

        if (previousStatus != AccountStatus.INACTIVE && account.getStatus() == AccountStatus.INACTIVE) {
            int revoked = authTokenRepository.revokeAllByAccountId(accountId, OffsetDateTime.now());
            log.info("Revoked {} active sessions after account {} was deactivated", revoked, accountId);
        }
        if (request.getStatus() != null && previousStatus != account.getStatus()) {
            authEventPublisher.sendAccountStatusChangedEvent(AccountStatusChangedEvent.builder()
                    .accountId(accountId)
                    .status(account.getStatus().name())
                    .build());
        }

        auditLogService.success("ACCOUNT_UPDATED", accountId, "Account updated",
                auditLogService.metadata(
                        "username", account.getUsername(),
                        "email", account.getEmail(),
                        "passwordChanged", StringUtils.hasText(request.getPassword()),
                        "oldRoles", oldRoles,
                        "newRoles", account.getRoles() != null ? account.getRoles().toString() : null,
                        "statusChanged", request.getStatus() != null
                ));

        return accountMapper.toAccountResponse(account);
    }

    /**
     * Admin creates an account for a new employee/member. No password is collected here —
     * the account is created PENDING with an unusable placeholder password hash, and an
     * activation email (containing a single-use token) is sent to the employee so they can
     * set their own password. See ActivateAccountRequest / activateAccount() below.
     */
    @Transactional
    public AccountResponse createAccount(CreateAccountRequest request) {
        String emailKey = request.getEmail().trim().toLowerCase();

        if (accountRepository.existsByEmail(emailKey)) {
            throw new AppException(AuthErrorCode.EMAIL_EXISTED);
        }

        String requestedRole = request.getRole().name();

        Role accountRole = roleRepository.findById(requestedRole)
                .orElseThrow(() -> new AppException(AuthErrorCode.ROLE_NOT_FOUND));

        String username = generateUniqueUsername(request.getFullName());

        // Unusable placeholder — nobody (including the admin) ever knows this value.
        // The real password is chosen by the employee via the activation link.
        String placeholderPasswordHash = passwordEncoder.encode(
                UUID.randomUUID().toString() + UUID.randomUUID());

        Account account = Account.builder()
                .username(username)
                .email(emailKey)
                .passwordHash(placeholderPasswordHash)
                .status(AccountStatus.PENDING)
                .roles(new HashSet<>(Set.of(accountRole)))
                .build();

        account = accountRepository.saveAndFlush(account);

        issueActivationToken(account, request.getFullName());

        // Notify user-service to create a bare profile (unchanged — user-service fills in
        // the rest of the profile later; this event only ever carried accountId + email).
        authEventPublisher.sendRegisteredEvent(UserRegisteredEvent.builder()
                .accountId(account.getAccountId())
                .email(account.getEmail())
                .build());

        auditLogService.success("ACCOUNT_CREATED", account.getAccountId(),
                "Account created by admin (pending activation)",
                auditLogService.metadata(
                        "username", account.getUsername(),
                        "email", emailKey,
                        "role", requestedRole
                ));

        return accountMapper.toAccountResponse(account);
    }

    /**
     * Employee clicks the activation link from their email and sets their own password.
     * Consumes the single-use token, flips the account to ACTIVE.
     */
    @Transactional
    public void activateAccount(ActivateAccountRequest request) {
        PasswordReset reset = passwordResetRepository.findByToken(request.getToken())
                .orElseThrow(() -> new AppException(AuthErrorCode.ACTIVATION_TOKEN_INVALID));

        if (Boolean.TRUE.equals(reset.getIsUsed())) {
            throw new AppException(AuthErrorCode.ACTIVATION_TOKEN_ALREADY_USED);
        }

        if (reset.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new AppException(AuthErrorCode.ACTIVATION_TOKEN_EXPIRED);
        }

        Account account = reset.getAccount();

        account.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        account.setStatus(AccountStatus.ACTIVE);
        account.setEmailVerifiedAt(LocalDateTime.now());
        accountRepository.save(account);

        authEventPublisher.sendAccountStatusChangedEvent(AccountStatusChangedEvent.builder()
                .accountId(account.getAccountId())
                .status(AccountStatus.ACTIVE.name())
                .build());

        reset.setIsUsed(true);
        reset.setUsedAt(OffsetDateTime.now());
        passwordResetRepository.save(reset);

        // Belt-and-braces: invalidate any other pending tokens for this account
        // (e.g. if resend-activation was called more than once).
        passwordResetRepository.invalidatePendingResets(account);

        auditLogService.success("ACCOUNT_ACTIVATED", account.getAccountId(),
                "Account activated by employee", auditLogService.metadata(
                        "username", account.getUsername()));

        log.info("Account {} activated", account.getAccountId());
    }

    /**
     * Admin-triggered resend when the original activation link expired (default TTL 24h)
     * before the employee used it.
     */
    @Transactional
    public void resendActivation(String accountId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new AppException(AuthErrorCode.ACCOUNT_NOT_FOUND));

        if (account.getStatus() != AccountStatus.PENDING) {
            throw new AppException(AuthErrorCode.ACCOUNT_ALREADY_ACTIVE);
        }

        passwordResetRepository.invalidatePendingResets(account);
        // auth-service does not persist fullName (user-service owns the profile) — fall
        // back to username for the email greeting on resend.
        issueActivationToken(account, account.getUsername());

        auditLogService.success("ACCOUNT_ACTIVATION_RESENT", account.getAccountId(),
                "Activation email resent by admin", null);
    }

    public AccountResponse myInfo() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(AuthErrorCode.ACCOUNT_NOT_FOUND));
        return accountMapper.toAccountResponse(account);
    }

    private void issueActivationToken(Account account, String displayName) {
        String token = UUID.randomUUID().toString() + UUID.randomUUID().toString().replace("-", "");

        passwordResetRepository.save(PasswordReset.builder()
                .account(account)
                .token(token)
                .expiresAt(OffsetDateTime.now().plusHours(activationTtlHours))
                .isUsed(false)
                .build());

        String activationLink = frontendUrl + "/activate-account?token=" + token;

        authEventPublisher.sendAccountActivationEvent(AccountActivationRequestedEvent.builder()
                .email(account.getEmail())
                .fullName(displayName)
                .activationLink(activationLink)
                .expiryHours((int) activationTtlHours)
                .build());
    }

    /**
     * Derives a unique, URL/login-safe username from a Vietnamese full name, e.g.
     * "Nguyễn Văn A" -> "nguyenvana" (or "nguyenvana2" if taken).
     */
    private String generateUniqueUsername(String fullName) {
        String base = NON_ALPHANUMERIC.matcher(stripDiacritics(fullName).toLowerCase())
                .replaceAll("");
        if (base.isBlank()) {
            base = "user";
        }

        String candidate = base;
        int suffix = 1;
        while (accountRepository.existsByUsername(candidate)) {
            suffix++;
            candidate = base + suffix;
        }
        return candidate;
    }

    private String stripDiacritics(String input) {
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD);
        String withoutMarks = DIACRITICS.matcher(normalized).replaceAll("");
        return withoutMarks.replace('đ', 'd').replace('Đ', 'D');
    }
}
