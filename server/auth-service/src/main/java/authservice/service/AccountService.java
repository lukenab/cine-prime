package authservice.service;

import authservice.dto.request.CreateAccountRequest;
import authservice.dto.request.UpdateAccountRequest;
import authservice.dto.response.AccountResponse;
import authservice.entity.Account;
import authservice.entity.Role;
import authservice.enums.AccountStatus;
import authservice.event.UserRegisteredEvent;
import authservice.exception.AuthErrorCode;
import authservice.mapper.AccountMapper;
import authservice.messaging.AuthEventPublisher;
import authservice.repository.AccountRepository;
import authservice.repository.RoleRepository;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AccountService {

    AccountRepository accountRepository;
    AccountMapper accountMapper;
    PasswordEncoder passwordEncoder;
    RoleRepository roleRepository;
    AuthEventPublisher authEventPublisher;
    AuditLogService auditLogService;

    public List<AccountResponse> getAllAccount() {
        return accountMapper.toAccountResponseList(accountRepository.findAll());
    }

    public AccountResponse getAccountById(String accountId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new AppException(AuthErrorCode.ACCOUNT_NOT_FOUND));
        return accountMapper.toAccountResponse(account);
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
            account.setRoles(new HashSet<>(roles));
        }

        if (request.getStatus() != null) {
            account.setStatus(request.getStatus());
        }

        accountRepository.save(account);

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

    @Transactional
    public AccountResponse createAccount(CreateAccountRequest request) {
        String emailKey = request.getEmail().trim().toLowerCase();

        if (accountRepository.existsByUsername(request.getUsername())) {
            throw new AppException(AuthErrorCode.USERNAME_EXISTED);
        }
        if (accountRepository.existsByEmail(emailKey)) {
            throw new AppException(AuthErrorCode.EMAIL_EXISTED);
        }

        String requestedRole = (request.getRole() != null && !request.getRole().isBlank())
                ? request.getRole().toUpperCase().trim()
                : "MEMBER";

        Role accountRole = roleRepository.findById(requestedRole)
                .orElseThrow(() -> new AppException(AuthErrorCode.ROLE_NOT_FOUND));

        Account account = Account.builder()
                .username(request.getUsername())
                .email(emailKey)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .status(AccountStatus.ACTIVE)
                .roles(new HashSet<>(Set.of(accountRole)))
                .build();

        account = accountRepository.saveAndFlush(account);

        // Notify user-service to create a bare profile
        authEventPublisher.sendRegisteredEvent(UserRegisteredEvent.builder()
                .accountId(account.getAccountId())
                .email(account.getEmail())
                .build());

        auditLogService.success("ACCOUNT_CREATED", account.getAccountId(), "Account created by admin",
                auditLogService.metadata(
                        "username", account.getUsername(),
                        "email", emailKey,
                        "role", requestedRole
                ));

        return accountMapper.toAccountResponse(account);
    }

    public AccountResponse myInfo() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(AuthErrorCode.ACCOUNT_NOT_FOUND));
        return accountMapper.toAccountResponse(account);
    }
}
