package authservice.service;

import authservice.client.UserClient;
import authservice.dto.request.*;
import authservice.dto.response.IntrospectResponse;
import authservice.entity.AuthToken;
import authservice.event.UserRegisteredEvent;
import authservice.dto.response.AuthenticationResponse;
import authservice.dto.response.AccountResponse;
import authservice.entity.Account;
import authservice.entity.Role;
import authservice.mapper.AccountMapper;
import authservice.producer.UserEventProducer;
import authservice.repository.AccountRepository;
import authservice.repository.AuthTokenRepository;
import authservice.repository.RoleRepository;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import feign.FeignException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movie.theater.common.exception.GlobalErrorCode;
import authservice.exception.AuthErrorCode;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.security.SecureRandom;
import java.text.ParseException;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthenticationService {
    AccountRepository accountRepository;
    RoleRepository roleRepository;
    AccountMapper accountMapper;
    PasswordEncoder passwordEncoder;
    JwtService jwtService;
    EmailService emailService;
    UserEventProducer userEventProducer;
    UserClient userClient;
    AuthTokenRepository authTokenRepository;


    StringRedisTemplate redisTemplate;

    private static final String DEFAULT_USER_ROLE = "USER";
    private static final String TOKEN_TYPE = "BEARER";
    private static final int ACCOUNT_STATUS_ACTIVE = 1;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final long OTP_TTL_MINUTES = 5;
    private static final long OTP_COOLDOWN_SECONDS = 60;

    public void checkFieldAvailability(String username, String email) {
        if (username != null && accountRepository.existsByUsername(username.trim())) {
            throw new AppException(AuthErrorCode.USERNAME_EXISTED);
        }
        if (email != null && accountRepository.existsByEmail(email.trim().toLowerCase())) {
            throw new AppException(AuthErrorCode.EMAIL_EXISTED);
        }
    }

    public void initiateRegistration(RegisterRequest request) {
        String emailKey = request.getEmail().trim().toLowerCase();

        validateUniqueFields(request.getUsername(), emailKey, request.getPhoneNumber(), request.getIdentityCard());
        generateAndSendOtp(emailKey);
    }


    public void resendOtp(ResendOtpRequest request) {
        String emailKey = request.getEmail().trim().toLowerCase();

        if (accountRepository.existsByEmail(emailKey)) {
            throw new AppException(AuthErrorCode.EMAIL_EXISTED);
        }

        String cooldownKey = "cooldown:otp:" + emailKey;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            throw new AppException(AuthErrorCode.RESEND_OTP_TOO_FAST);
        }

        redisTemplate.opsForValue().set(cooldownKey, "locked", OTP_COOLDOWN_SECONDS, TimeUnit.SECONDS);
        generateAndSendOtp(emailKey);
        log.info("Resent new OTP for email: {}", emailKey);
    }

    @Transactional
    public AccountResponse verifyOtpAndRegister(VerifyOtpRequest request) {
        RegisterRequest registerRequest = request.getRegisterRequest();

        String emailKey = registerRequest.getEmail().trim().toLowerCase();
        String inputOtp = request.getOtp() != null ? request.getOtp().trim() : "";

        String cachedOtp = redisTemplate.opsForValue().get(emailKey);

        if (cachedOtp == null) {
            throw new AppException(AuthErrorCode.OTP_EXPIRED);
        }

        if (!cachedOtp.equals(inputOtp)) {
            throw new AppException(AuthErrorCode.INVALID_OTP);
        }

        redisTemplate.delete(emailKey);

        validateUniqueFields(registerRequest.getUsername(), emailKey, registerRequest.getPhoneNumber(), registerRequest.getIdentityCard());

        Account account = accountMapper.toAccount(registerRequest);
        account.setPasswordHash(passwordEncoder.encode(registerRequest.getPassword()));
        account.setStatus(ACCOUNT_STATUS_ACTIVE);

        Role accountRole = roleRepository.findById(DEFAULT_USER_ROLE)
                .orElseThrow(() -> new AppException(AuthErrorCode.ROLE_NOT_FOUND));

        account.setRoles(new HashSet<>(Set.of(accountRole)));
        account = accountRepository.saveAndFlush(account);

        UserRegisteredEvent userRegisteredEvent = UserRegisteredEvent.builder()
                .accountId(account.getAccountId())
                .fullName(registerRequest.getFullName())
                .phoneNumber(registerRequest.getPhoneNumber())
                .address(registerRequest.getAddress())
                .gender(registerRequest.getGender())
                .dateOfBirth(registerRequest.getDateOfBirth())
                .identityCard(registerRequest.getIdentityCard())
                .build();

        userEventProducer.sendRegisteredEvent(userRegisteredEvent);

        return accountMapper.toAccountResponse(account);
    }

    @Transactional
    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        Account account = accountRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new AppException(GlobalErrorCode.UNAUTHENTICATED));

        // if (!passwordEncoder.matches(request.getPassword(), account.getPasswordHash())) {
        //     throw new AppException(GlobalErrorCode.UNAUTHENTICATED);
        // }

        // if (account.getStatus() == null || account.getStatus() != ACCOUNT_STATUS_ACTIVE) {
        //     throw new AppException(AuthErrorCode.ACCOUNT_INACTIVE);
        // }

        account.setLastLoginAt(LocalDateTime.now());
        accountRepository.save(account);

        String token = jwtService.generateToken(account);
        saveAuthToken(account, token);

        return AuthenticationResponse.builder().authenticate(true).token(token).build();
    }

    @Transactional
    public void logout(LogoutRequest request) throws ParseException, JOSEException {
        logoutByToken(request.getToken());
    }

    @Transactional
    public void logoutByToken(String token) throws ParseException, JOSEException {
        SignedJWT signedToken = jwtService.verifyToken(token, false);
        authTokenRepository.revokeByJwtId(
                signedToken.getJWTClaimsSet().getJWTID(),
                OffsetDateTime.now()
        );
    }

    public IntrospectResponse introspect(IntrospectRequest request) {
        boolean isValid = true;
        try {
            jwtService.verifyToken(request.getToken(), false);
        } catch (AppException | ParseException | JOSEException e) {
            isValid = false;
        }
        return IntrospectResponse.builder().valid(isValid).build();
    }

    @Transactional
    public AuthenticationResponse refreshToken(RefreshRequest request) throws ParseException, JOSEException {
        SignedJWT signedJWT = jwtService.verifyToken(request.getToken(), true);

        authTokenRepository.revokeByJwtId(
                signedJWT.getJWTClaimsSet().getJWTID(),
                OffsetDateTime.now()
        );

        Account account = accountRepository.findByUsername(signedJWT.getJWTClaimsSet().getSubject())
                .orElseThrow(() -> new AppException(GlobalErrorCode.UNAUTHENTICATED));

        String newToken = jwtService.generateToken(account);
        saveAuthToken(account, newToken);

        return AuthenticationResponse.builder().authenticate(true).token(newToken).build();
    }

    private void generateAndSendOtp(String emailKey) {
        String otp = String.format("%06d", SECURE_RANDOM.nextInt(1000000));
        redisTemplate.opsForValue().set(emailKey, otp, OTP_TTL_MINUTES, TimeUnit.MINUTES);
        emailService.sendOtpEmail(emailKey, otp);
        log.info("OTP sent to email: {}", emailKey);
    }

    private void validateUniqueFields(String username, String emailKey, String phone, String identityCard) {
        if (accountRepository.existsByUsername(username)) {
            throw new AppException(AuthErrorCode.USERNAME_EXISTED);
        }
        if (accountRepository.existsByEmail(emailKey)) {
            throw new AppException(AuthErrorCode.EMAIL_EXISTED);
        }
        try {
            var response = userClient.checkExistence(phone, identityCard);
            var data = response.getResult();
            if (data.isPhoneExists()) throw new AppException(AuthErrorCode.PHONE_EXISTED);
            if (data.isIdentityCardExists()) throw new AppException(AuthErrorCode.IDENTITY_CARD_EXISTED);
        } catch (FeignException e) {
            log.warn("User-service unavailable. Skipping phone/identity check.");
        }
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
                    .token(tokenString)
                    .tokenType(TOKEN_TYPE)
                    .issuedAt(claims.getIssueTime().toInstant().atOffset(ZoneOffset.UTC))
                    .expiresAt(claims.getExpirationTime().toInstant().atOffset(ZoneOffset.UTC))
                    .isRevoked(false)
                    .createdIp(ip)
                    .userAgent(userAgent)
                    .build());
        } catch (ParseException | RuntimeException e) {
            log.error("Failed to save auth token record", e);
            throw new AppException(GlobalErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }
}