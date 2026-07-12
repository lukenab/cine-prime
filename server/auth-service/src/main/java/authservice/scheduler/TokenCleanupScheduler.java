package authservice.scheduler;

import authservice.repository.AuthTokenRepository;
import authservice.repository.PasswordResetRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class TokenCleanupScheduler {

    private final AuthTokenRepository authTokenRepository;
    private final PasswordResetRepository passwordResetRepository;

    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void purgeExpiredTokens() {
        authTokenRepository.deleteExpiredTokens(OffsetDateTime.now());
        log.info("Purged expired auth tokens");
    }

    /**
     * Purges expired activation / password-reset tokens (password_reset table).
     * Reuses the deleteExpiredResets() query added for Issue #161.
     */
    @Scheduled(cron = "0 30 2 * * *")
    @Transactional
    public void purgeExpiredPasswordResets() {
        passwordResetRepository.deleteExpiredResets(OffsetDateTime.now());
        log.info("Purged expired password resets");
    }
}
