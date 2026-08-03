package authservice.service;

import authservice.dto.request.ResetPasswordRequest;
import authservice.entity.Account;
import authservice.entity.PasswordReset;
import authservice.enums.AccountStatus;
import authservice.enums.PasswordResetPurpose;
import authservice.event.PasswordResetRequestedEvent;
import authservice.exception.AuthErrorCode;
import authservice.messaging.AuthEventPublisher;
import authservice.repository.AccountRepository;
import authservice.repository.AuthTokenRepository;
import authservice.repository.PasswordResetRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class PasswordRecoveryService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final AccountRepository accountRepository;
    private final PasswordResetRepository passwordResetRepository;
    private final AuthTokenRepository authTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthEventPublisher eventPublisher;
    private final AbuseProtectionService abuseProtectionService;
    private final AuditLogService auditLogService;

    @Value("${auth.password-reset.ttl-minutes:30}")
    private int ttlMinutes;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    /** Always returns normally for unknown/inactive emails to prevent account enumeration. */
    @Transactional
    public void requestReset(String email) {
        String normalizedEmail = email.trim().toLowerCase();
        abuseProtectionService.guardPasswordReset(normalizedEmail);

        accountRepository.findByEmail(normalizedEmail)
                .filter(account -> account.getStatus() == AccountStatus.ACTIVE)
                .ifPresent(account -> issueReset(account));
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String tokenHash = hash(request.getToken());
        PasswordReset reset = passwordResetRepository
                .findByTokenAndPurpose(tokenHash, PasswordResetPurpose.PASSWORD_RESET)
                .orElseThrow(() -> new AppException(AuthErrorCode.PASSWORD_RESET_TOKEN_INVALID));

        if (Boolean.TRUE.equals(reset.getIsUsed())) {
            throw new AppException(AuthErrorCode.PASSWORD_RESET_TOKEN_INVALID);
        }
        if (reset.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new AppException(AuthErrorCode.PASSWORD_RESET_TOKEN_EXPIRED);
        }
        if (reset.getAccount().getStatus() != AccountStatus.ACTIVE) {
            throw new AppException(AuthErrorCode.ACCOUNT_INACTIVE);
        }

        Account account = reset.getAccount();
        account.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        account.setFailedLoginAttempts(0);
        account.setLockedUntil(null);
        accountRepository.save(account);

        reset.setIsUsed(true);
        reset.setUsedAt(OffsetDateTime.now());
        passwordResetRepository.save(reset);
        passwordResetRepository.invalidatePendingResets(account, PasswordResetPurpose.PASSWORD_RESET);

        authTokenRepository.revokeAllByAccountId(account.getAccountId(), OffsetDateTime.now());
        auditLogService.success("PASSWORD_RESET_COMPLETED", account.getAccountId(),
                "Password reset completed and existing sessions revoked", null);
    }

    private void issueReset(Account account) {
        passwordResetRepository.invalidatePendingResets(account, PasswordResetPurpose.PASSWORD_RESET);

        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        passwordResetRepository.save(PasswordReset.builder()
                .account(account)
                // Only a one-way digest is persisted; the raw credential exists in the email link only.
                .token(hash(rawToken))
                .purpose(PasswordResetPurpose.PASSWORD_RESET)
                .expiresAt(OffsetDateTime.now().plusMinutes(ttlMinutes))
                .isUsed(false)
                .build());

        eventPublisher.sendPasswordResetEvent(PasswordResetRequestedEvent.builder()
                .email(account.getEmail())
                .resetLink(frontendUrl + "/reset-password?token=" + rawToken)
                .expiryMinutes(ttlMinutes)
                .build());
        auditLogService.success("PASSWORD_RESET_REQUESTED", account.getAccountId(),
                "Password reset email requested", null);
    }

    private String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception impossible) {
            throw new IllegalStateException("SHA-256 unavailable", impossible);
        }
    }
}
