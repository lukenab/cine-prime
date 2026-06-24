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

import java.text.ParseException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.Random;
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

    public void initiateRegistration(RegisterRequest request) {
        String emailKey = request.getEmail().trim().toLowerCase();

        if (accountRepository.existsByUsername(request.getUsername())) {
            throw new AppException(AuthErrorCode.USERNAME_EXISTED);
        }
        if (accountRepository.existsByEmail(emailKey)) {
            throw new AppException(AuthErrorCode.EMAIL_EXISTED);
        }

        try {
            var response = userClient.checkExistence(request.getPhoneNumber(), request.getIdentityCard());
            var existenceData = response.getResult();

            if (existenceData.isPhoneExists()) {
                throw new AppException(AuthErrorCode.PHONE_EXISTED);
            }

            if (existenceData.isIdentityCardExists()) {
                throw new AppException(AuthErrorCode.IDENTITY_CARD_EXISTED);
            }
        } catch (FeignException e) {
            log.warn("User-service is currently unavailable.");
        }

        String otp = String.format("%06d", new Random().nextInt(999999));
        redisTemplate.opsForValue().set(emailKey, otp, 5, TimeUnit.MINUTES);
        emailService.sendOtpEmail(emailKey, otp);
        log.info("Saved OTP [{}] in redis for email: {}", otp, emailKey);
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

        String newOtp = String.format("%06d", new Random().nextInt(999999));
        redisTemplate.opsForValue().set(emailKey, newOtp, 5, TimeUnit.MINUTES);

        redisTemplate.opsForValue().set(cooldownKey, "locked", 60, TimeUnit.SECONDS);

        emailService.sendOtpEmail(emailKey, newOtp);
        log.info("Resent new OTP [{}] for email: {}", newOtp, emailKey);
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

        if (accountRepository.existsByUsername(registerRequest.getUsername())) {
            throw new AppException(AuthErrorCode.USERNAME_EXISTED);
        }
        if (accountRepository.existsByEmail(emailKey)) {
            throw new AppException(AuthErrorCode.EMAIL_EXISTED);
        }

        Account account = accountMapper.toAccount(registerRequest);
        account.setPasswordHash(passwordEncoder.encode(registerRequest.getPassword()));
        account.setStatus(1);

        Role accountRole = roleRepository.findById(DEFAULT_USER_ROLE)
                .orElseThrow(() -> new AppException(AuthErrorCode.ROLE_NOT_FOUND));

        HashSet<Role> roles = new HashSet<>();
        roles.add(accountRole);

        account.setRoles(roles);
        account = accountRepository.saveAndFlush(account);

        UserRegisteredEvent userRegisteredEvent = UserRegisteredEvent.builder()
                .accountId(account.getAccountId())
                .fullName(registerRequest.getFullName())
                .phoneNumber(registerRequest.getPhoneNumber())
                .address(registerRequest.getAddress())
                .gender(registerRequest.getGender())
                .dateOfBirth(registerRequest.getDateOfBirth())
                .email(registerRequest.getEmail())
                .identityCard(registerRequest.getIdentityCard())
                .build();

        userEventProducer.sendRegisteredEvent(userRegisteredEvent);

        return accountMapper.toAccountResponse(account);
    }

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        Account account = accountRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new AppException(GlobalErrorCode.UNAUTHENTICATED));

        if (!passwordEncoder.matches(request.getPassword(), account.getPasswordHash())) {
            throw new AppException(GlobalErrorCode.UNAUTHENTICATED);
        }

        String token = jwtService.generateToken(account);
        saveAuthToken(account, token);

        return AuthenticationResponse.builder().authenticate(true).token(token).build();
    }

    @Transactional
    public void logout(LogoutRequest request) throws ParseException, JOSEException {
        SignedJWT signedToken = jwtService.parseAndVerifySignature(request.getToken());
        authTokenRepository.revokeByJwtId(
                signedToken.getJWTClaimsSet().getJWTID(),
                OffsetDateTime.now()
        );
    }

    public IntrospectResponse introspect(IntrospectRequest request) throws ParseException, JOSEException {
        boolean isValid = true;
        try {
            jwtService.verifyToken(request.getToken(), false);
        } catch (AppException e) {
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
                    .tokenType("BEARER")
                    .issuedAt(claims.getIssueTime().toInstant().atOffset(ZoneOffset.UTC))
                    .expiresAt(claims.getExpirationTime().toInstant().atOffset(ZoneOffset.UTC))
                    .isRevoked(false)
                    .createdIp(ip)
                    .userAgent(userAgent)
                    .build());
        } catch (ParseException e) {
            log.error("Failed to save auth token record", e);
            throw new AppException(GlobalErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }
}