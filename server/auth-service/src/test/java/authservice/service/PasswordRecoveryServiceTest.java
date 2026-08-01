package authservice.service;

import authservice.dto.request.ResetPasswordRequest;
import authservice.entity.Account;
import authservice.entity.PasswordReset;
import authservice.enums.AccountStatus;
import authservice.enums.PasswordResetPurpose;
import authservice.event.PasswordResetRequestedEvent;
import authservice.messaging.AuthEventPublisher;
import authservice.repository.AccountRepository;
import authservice.repository.AuthTokenRepository;
import authservice.repository.PasswordResetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordRecoveryServiceTest {

    @Mock AccountRepository accountRepository;
    @Mock PasswordResetRepository passwordResetRepository;
    @Mock AuthTokenRepository authTokenRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock AuthEventPublisher eventPublisher;
    @Mock AbuseProtectionService abuseProtectionService;
    @Mock AuditLogService auditLogService;

    PasswordRecoveryService service;

    @BeforeEach
    void setUp() {
        service = new PasswordRecoveryService(accountRepository, passwordResetRepository,
                authTokenRepository, passwordEncoder, eventPublisher,
                abuseProtectionService, auditLogService);
        ReflectionTestUtils.setField(service, "ttlMinutes", 30);
        ReflectionTestUtils.setField(service, "frontendUrl", "http://localhost:3000");
    }

    @Test
    void unknownEmailReturnsWithoutRevealingAccountExistence() {
        when(accountRepository.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        service.requestReset(" Missing@Example.com ");

        verify(abuseProtectionService).guardPasswordReset("missing@example.com");
        verify(passwordResetRepository, never()).save(any());
        verify(eventPublisher, never()).sendPasswordResetEvent(any());
    }

    @Test
    void activeAccountReceivesRawTokenWhileOnlyDigestIsPersisted() {
        Account account = activeAccount();
        when(accountRepository.findByEmail(account.getEmail())).thenReturn(Optional.of(account));

        service.requestReset(account.getEmail());

        ArgumentCaptor<PasswordReset> resetCaptor = ArgumentCaptor.forClass(PasswordReset.class);
        verify(passwordResetRepository).save(resetCaptor.capture());
        PasswordReset persisted = resetCaptor.getValue();
        assertThat(persisted.getPurpose()).isEqualTo(PasswordResetPurpose.PASSWORD_RESET);
        assertThat(persisted.getToken()).hasSize(64).matches("[0-9a-f]{64}");
        assertThat(persisted.getExpiresAt()).isAfter(OffsetDateTime.now().plusMinutes(29));

        ArgumentCaptor<PasswordResetRequestedEvent> eventCaptor =
                ArgumentCaptor.forClass(PasswordResetRequestedEvent.class);
        verify(eventPublisher).sendPasswordResetEvent(eventCaptor.capture());
        String rawToken = eventCaptor.getValue().getResetLink().split("token=", 2)[1];
        assertThat(rawToken).isNotEqualTo(persisted.getToken());
        assertThat(sha256(rawToken)).isEqualTo(persisted.getToken());
    }

    @Test
    void validResetChangesPasswordAndRevokesExistingSessions() {
        String rawToken = "valid-reset-token";
        Account account = activeAccount();
        PasswordReset reset = PasswordReset.builder()
                .account(account)
                .token(sha256(rawToken))
                .purpose(PasswordResetPurpose.PASSWORD_RESET)
                .expiresAt(OffsetDateTime.now().plusMinutes(5))
                .isUsed(false)
                .build();
        when(passwordResetRepository.findByTokenAndPurpose(sha256(rawToken), PasswordResetPurpose.PASSWORD_RESET))
                .thenReturn(Optional.of(reset));
        when(passwordEncoder.encode("NewPassword1")).thenReturn("new-hash");

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken(rawToken);
        request.setNewPassword("NewPassword1");
        service.resetPassword(request);

        assertThat(account.getPasswordHash()).isEqualTo("new-hash");
        assertThat(account.getFailedLoginAttempts()).isZero();
        assertThat(account.getLockedUntil()).isNull();
        assertThat(reset.getIsUsed()).isTrue();
        verify(authTokenRepository).revokeAllByAccountId(any(), any());
        verify(passwordResetRepository).invalidatePendingResets(account, PasswordResetPurpose.PASSWORD_RESET);
    }

    private Account activeAccount() {
        return Account.builder()
                .accountId("account-1")
                .username("member1")
                .email("member@example.com")
                .passwordHash("old-hash")
                .status(AccountStatus.ACTIVE)
                .failedLoginAttempts(4)
                .build();
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }
}
