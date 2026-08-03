package authservice.service;
import authservice.annotation.Auditable;

import authservice.dto.request.IntrospectTokenRequest;
import authservice.dto.request.LoginRequest;
import authservice.dto.request.RefreshTokenRequest;
import authservice.dto.response.IntrospectResponse;
import authservice.dto.response.LoginResponse;
import authservice.entity.Account;
import authservice.entity.AuthToken;
import authservice.enums.AccountStatus;
import authservice.exception.AuthErrorCode;
import authservice.repository.AccountRepository;
import authservice.repository.AuthTokenRepository;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.annotation.PostConstruct;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movie.theater.common.exception.GlobalErrorCode;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.text.ParseException;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthenticationService {

    AccountRepository accountRepository;
    PasswordEncoder passwordEncoder;
    JwtService jwtService;
    AuthTokenRepository authTokenRepository;
    AuditLogService auditLogService;
    AbuseProtectionService abuseProtectionService;

    @NonFinal
    String dummyPasswordHash;

    private static final String TOKEN_TYPE = "BEARER";
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCK_DURATION_MINUTES = 15;

    @PostConstruct
    void initializeDummyPasswordHash() {
        dummyPasswordHash = passwordEncoder.encode("cineprime-nonexistent-account");
    }

    @Transactional(dontRollbackOn = AppException.class)
    public LoginResponse authenticate(LoginRequest request) {
        abuseProtectionService.guardLogin(request.getUsername());
        Account account = accountRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> {
                    // Perform the same expensive password operation for missing accounts to
                    // reduce username enumeration through response-time differences.
                    passwordEncoder.matches(request.getPassword(), dummyPasswordHash);
                    auditLogService.failed("LOGIN_FAILED", null, "Account not found",
                            auditLogService.metadata("username", request.getUsername()));
                    return new AppException(GlobalErrorCode.UNAUTHENTICATED);
                });

        // 1. Check account lock BEFORE password check to prevent timing attacks
        if (account.getLockedUntil() != null && account.getLockedUntil().isAfter(LocalDateTime.now())) {
            auditLogService.failed("LOGIN_FAILED", account.getAccountId(), "Account locked",
                    auditLogService.metadata("username", request.getUsername()));
            throw new AppException(AuthErrorCode.ACCOUNT_LOCKED);
        }

        // 2. Check account status
        if (account.getStatus() == null || account.getStatus() != AccountStatus.ACTIVE) {
            auditLogService.failed("LOGIN_FAILED", account.getAccountId(),
                    "Account status " + account.getStatus(),
                    auditLogService.metadata("username", request.getUsername()));
            // PENDING = admin created the account but the employee hasn't used the
            // activation email yet — distinct from INACTIVE (admin disabled the account).
            if (account.getStatus() == AccountStatus.PENDING) {
                throw new AppException(AuthErrorCode.ACCOUNT_PENDING_ACTIVATION);
            }
            throw new AppException(AuthErrorCode.ACCOUNT_INACTIVE);
        }

        // 3. Validate password — increment failed counter and lock if threshold reached
        if (!passwordEncoder.matches(request.getPassword(), account.getPasswordHash())) {
            int attempts = account.getFailedLoginAttempts() + 1;
            account.setFailedLoginAttempts(attempts);
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                account.setLockedUntil(LocalDateTime.now().plusMinutes(LOCK_DURATION_MINUTES));
                auditLogService.failed("LOGIN_FAILED", account.getAccountId(),
                        "Account locked after " + attempts + " failed attempts",
                        auditLogService.metadata("username", request.getUsername()));
            } else {
                auditLogService.failed("LOGIN_FAILED", account.getAccountId(),
                        "Invalid password (attempt " + attempts + "/" + MAX_FAILED_ATTEMPTS + ")",
                        auditLogService.metadata("username", request.getUsername()));
            }
            accountRepository.save(account);
            throw new AppException(GlobalErrorCode.UNAUTHENTICATED);
        }

        // 4. Success — reset brute-force counters
        account.setFailedLoginAttempts(0);
        account.setLockedUntil(null);
        account.setLastLoginAt(LocalDateTime.now());
        accountRepository.save(account);
        abuseProtectionService.loginSucceeded(account.getUsername());

        String token = jwtService.generateToken(account);
        saveAuthToken(account, token);
        auditLogService.success("LOGIN_SUCCESS", account.getAccountId(), "Logged in successfully",
                auditLogService.metadata("username", account.getUsername()));

        return LoginResponse.builder().authenticated(true).token(token).build();
    }

    @Auditable(action = "LOGOUT", successMessage = "Logged out successfully")
    @Transactional
    public void logout(String token) throws ParseException, JOSEException {
        SignedJWT signedToken = jwtService.verifyToken(token, false);
        authTokenRepository.revokeByJwtId(
                signedToken.getJWTClaimsSet().getJWTID(),
                OffsetDateTime.now()
        );
    }

    public IntrospectResponse introspect(IntrospectTokenRequest request) {
        boolean isValid = true;
        try {
            jwtService.verifyToken(request.getToken(), false);
        } catch (AppException | ParseException | JOSEException e) {
            isValid = false;
        }
        return IntrospectResponse.builder().valid(isValid).build();
    }

    @Auditable(action = "TOKEN_REFRESH_SUCCESS", successMessage = "Token refreshed successfully")
    @Transactional
    public LoginResponse refreshToken(RefreshTokenRequest request) throws ParseException, JOSEException {
        SignedJWT signedJWT;
        signedJWT = jwtService.verifyToken(request.getToken(), true);

        authTokenRepository.revokeByJwtId(
                signedJWT.getJWTClaimsSet().getJWTID(),
                OffsetDateTime.now()
        );

        Account account = accountRepository.findByUsername(signedJWT.getJWTClaimsSet().getSubject())
                .orElseThrow(() -> new AppException(GlobalErrorCode.UNAUTHENTICATED));

        if (account.getLockedUntil() != null && account.getLockedUntil().isAfter(LocalDateTime.now())) {
            throw new AppException(AuthErrorCode.ACCOUNT_LOCKED);
        }

        if (account.getStatus() != AccountStatus.ACTIVE) {
            throw new AppException(AuthErrorCode.ACCOUNT_INACTIVE);
        }

        String newToken = jwtService.generateToken(account);
        saveAuthToken(account, newToken);

        return LoginResponse.builder().authenticated(true).token(newToken).build();
    }

    private void saveAuthToken(Account account, String tokenString) {
        try {
            JWTClaimsSet claims = SignedJWT.parse(tokenString).getJWTClaimsSet();

            String ip = null;
            String userAgent = null;
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest req = attrs.getRequest();
                ip = req.getRemoteAddr();
                userAgent = req.getHeader("User-Agent");
            }

            authTokenRepository.save(AuthToken.builder()
                    .account(account)
                    .jwtId(claims.getJWTID())
                    .tokenType(TOKEN_TYPE)
                    .issuedAt(claims.getIssueTime().toInstant().atOffset(ZoneOffset.UTC))
                    .expiresAt(claims.getExpirationTime().toInstant().atOffset(ZoneOffset.UTC))
                    .isRevoked(false)
                    .createdIp(ip)
                    .userAgent(userAgent)
                    .build());
        } catch (ParseException e) {
            log.error("Failed to parse JWT while saving auth token for account {}: {}", account.getAccountId(), e.getMessage());
        }
    }
}
