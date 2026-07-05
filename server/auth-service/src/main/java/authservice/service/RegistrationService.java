package authservice.service;

import authservice.annotation.Auditable;
import authservice.dto.request.RegisterRequest;
import authservice.dto.request.ResendOtpRequest;
import authservice.dto.request.VerifyOtpRequest;
import authservice.dto.response.RegisterResponse;
import authservice.entity.Account;
import authservice.entity.Role;
import authservice.enums.AccountStatus;
import authservice.event.OtpRequestedEvent;
import authservice.event.UserRegisteredEvent;
import authservice.exception.AuthErrorCode;
import authservice.mapper.AccountMapper;
import authservice.messaging.AuthEventPublisher;
import authservice.repository.AccountRepository;
import authservice.repository.RoleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movie.theater.common.exception.GlobalErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RegistrationService {

    AccountRepository accountRepository;
    RoleRepository roleRepository;
    AccountMapper accountMapper;
    PasswordEncoder passwordEncoder;
    AuthEventPublisher authEventPublisher;
    AuditLogService auditLogService;
    ObjectMapper objectMapper;
    StringRedisTemplate redisTemplate;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String PENDING_REGISTER_KEY_PREFIX = "pending:register:";
    private static final String OTP_KEY_PREFIX = "otp:register:";
    private static final String OTP_COOLDOWN_KEY_PREFIX = "cooldown:otp:";

    @NonFinal
    @Value("${auth.default-role}")
    String defaultRole;

    @NonFinal
    @Value("${auth.otp.ttl-minutes}")
    long otpTtlMinutes;

    @NonFinal
    @Value("${auth.otp.cooldown-seconds}")
    long otpCooldownSeconds;

    public void checkAvailability(String username, String email) {
        if (username != null && accountRepository.existsByUsername(username.trim())) {
            throw new AppException(AuthErrorCode.USERNAME_EXISTED);
        }
        if (email != null && accountRepository.existsByEmail(email.trim().toLowerCase())) {
            throw new AppException(AuthErrorCode.EMAIL_EXISTED);
        }
    }

    @Auditable(action = "REGISTER_INITIATED", successMessage = "Registration OTP sent")
    public void initiateRegistration(RegisterRequest request) {
        String emailKey = request.getEmail().trim().toLowerCase();
        checkAvailability(request.getUsername(), emailKey);

        String cooldownKey = OTP_COOLDOWN_KEY_PREFIX + emailKey;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            throw new AppException(AuthErrorCode.RESEND_OTP_TOO_FAST);
        }

        request.setPassword(passwordEncoder.encode(request.getPassword()));
        storePendingRegistration(emailKey, request);
        dispatchOtp(emailKey);
        redisTemplate.opsForValue().set(cooldownKey, "locked", otpCooldownSeconds, TimeUnit.SECONDS);
    }

    @Auditable(action = "OTP_RESEND_REQUESTED", successMessage = "Registration OTP resent")
    public void resendOtp(ResendOtpRequest request) {
        String emailKey = request.getEmail().trim().toLowerCase();
        if (accountRepository.existsByEmail(emailKey)) {
            throw new AppException(AuthErrorCode.EMAIL_EXISTED);
        }

        String cooldownKey = OTP_COOLDOWN_KEY_PREFIX + emailKey;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            throw new AppException(AuthErrorCode.RESEND_OTP_TOO_FAST);
        }

        redisTemplate.opsForValue().set(cooldownKey, "locked", otpCooldownSeconds, TimeUnit.SECONDS);

        String pendingKey = PENDING_REGISTER_KEY_PREFIX + emailKey;
        if (!Boolean.TRUE.equals(redisTemplate.hasKey(pendingKey))) {
            throw new AppException(AuthErrorCode.REGISTRATION_NOT_INITIATED);  // cần add error code này
        }
        redisTemplate.expire(pendingKey, otpTtlMinutes, TimeUnit.MINUTES);

        dispatchOtp(emailKey);
        log.info("Resent new OTP for email: {}", emailKey);
    }

    @Transactional
    public RegisterResponse completeRegistration(VerifyOtpRequest request) {
        String emailKey = request.getEmail().trim().toLowerCase();
        String inputOtp = request.getOtp().trim();

        RegisterRequest pending = resolvePendingRegistration(emailKey, inputOtp);

        checkAvailability(pending.getUsername(), emailKey);

        Account account = provisionAccount(pending);

        authEventPublisher.sendRegisteredEvent(UserRegisteredEvent.builder()
                .accountId(account.getAccountId())
                .email(emailKey)
                .build());

        auditLogService.success("REGISTER_COMPLETED", account.getAccountId(),
                "Account registered successfully",
                auditLogService.metadata(
                        "username", pending.getUsername(),
                        "email", emailKey
                ));

        return accountMapper.toRegisterResponse(account);
    }

    private void dispatchOtp(String emailKey) {
        String otp = String.format("%06d", SECURE_RANDOM.nextInt(1000000));
        redisTemplate.opsForValue().set(OTP_KEY_PREFIX + emailKey, otp, otpTtlMinutes, TimeUnit.MINUTES);
        authEventPublisher.sendOtpRequestedEvent(
                OtpRequestedEvent.builder()
                        .email(emailKey)
                        .otp(otp)
                        .expiryMinutes((int) otpTtlMinutes)
                        .build()
        );
    }

    private RegisterRequest resolvePendingRegistration(String emailKey, String otp) {
        String cachedOtp = redisTemplate.opsForValue().get(OTP_KEY_PREFIX + emailKey);
        if (cachedOtp == null) {
            auditLogService.failed("REGISTER_OTP_VERIFIED", null, "OTP expired",
                    auditLogService.metadata("email", emailKey));
            throw new AppException(AuthErrorCode.OTP_EXPIRED);
        }

        if (!cachedOtp.equals(otp)) {
            auditLogService.failed("REGISTER_OTP_VERIFIED", null, "Invalid OTP",
                    auditLogService.metadata("email", emailKey));
            throw new AppException(AuthErrorCode.INVALID_OTP);
        }

        String pendingKey = PENDING_REGISTER_KEY_PREFIX + emailKey;
        String pendingJson = redisTemplate.opsForValue().get(pendingKey);

        if (pendingJson == null) {
            auditLogService.failed("REGISTER_OTP_VERIFIED", null, "Pending registration data expired",
                    auditLogService.metadata("email", emailKey));
            throw new AppException(AuthErrorCode.OTP_EXPIRED);
        }

        RegisterRequest registerRequest;
        try {
            registerRequest = objectMapper.readValue(pendingJson, RegisterRequest.class);
        } catch (Exception e) {
            log.error("Failed to deserialize pending registration data for email {}", emailKey, e);
            throw new AppException(GlobalErrorCode.UNCATEGORIZED_EXCEPTION);
        }

        redisTemplate.delete(OTP_KEY_PREFIX + emailKey);
        redisTemplate.delete(pendingKey);

        return registerRequest;
    }

    private Account provisionAccount(RegisterRequest request){
        Account account = accountMapper.toAccount(request);

        account.setPasswordHash(request.getPassword());
        account.setStatus(AccountStatus.ACTIVE);
        account.setEmailVerifiedAt(LocalDateTime.now());

        Role userRole = roleRepository.findById(defaultRole)
                .orElseThrow(() -> new AppException(AuthErrorCode.ROLE_NOT_FOUND));

        account.setRoles(new HashSet<>(Set.of(userRole)));

        return accountRepository.saveAndFlush(account);
    }

    private void storePendingRegistration(String emailKey, RegisterRequest request) {
        try {
            String pendingKey = PENDING_REGISTER_KEY_PREFIX + emailKey;
            redisTemplate.opsForValue().set(
                    pendingKey, objectMapper.writeValueAsString(request),
                    otpTtlMinutes, TimeUnit.MINUTES);
        } catch (Exception e) {
            log.error("Failed to serialize pending registration data for email {}", emailKey, e);
            throw new AppException(GlobalErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }
}
