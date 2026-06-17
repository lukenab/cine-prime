package authservice.service;

import authservice.dto.request.AuthenticationRequest;
import authservice.dto.request.RegisterRequest;
import authservice.dto.request.UserCreationRequest;
import authservice.dto.request.VerifyOtpRequest;
import authservice.dto.response.AuthenticationResponse;
import authservice.dto.response.RegisterResponse;
import authservice.entity.Account;
import authservice.entity.Role;
import authservice.mapper.AccountMapper;
import authservice.repository.AccountRepository;
import authservice.repository.RoleRepository;
import authservice.repository.UserProfileClient;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movie.theater.common.exception.GlobalErrorCode;
import authservice.exception.AuthErrorCode;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
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
    UserProfileClient userProfileClient;
    JwtService jwtService;
    EmailService emailService;

    StringRedisTemplate redisTemplate;

    public void initiateRegistration(RegisterRequest request) {
        String emailKey = request.getEmail().trim().toLowerCase();

        if (accountRepository.existsByUsername(request.getUsername())) {
            throw new AppException(AuthErrorCode.USERNAME_EXISTED);
        }
        if (accountRepository.existsByEmail(emailKey)) {
            throw new AppException(AuthErrorCode.EMAIL_EXISTED);
        }

        String otp = String.format("%06d", new Random().nextInt(999999));

        redisTemplate.opsForValue().set(emailKey, otp, 5, TimeUnit.MINUTES);

        emailService.sendOtpEmail(emailKey, otp);
        log.info("Saved OTP [{}] in redis for email: {}", otp, emailKey);
    }

    @Transactional
    public RegisterResponse verifyOtpAndRegister(VerifyOtpRequest request) {
        RegisterRequest regReq = request.getRegisterRequest();

        String emailKey = regReq.getEmail().trim().toLowerCase();
        String inputOtp = request.getOtp() != null ? request.getOtp().trim() : "";

        String cachedOtp = redisTemplate.opsForValue().get(emailKey);

        if (cachedOtp == null || !cachedOtp.equals(inputOtp)) {
            throw new AppException(AuthErrorCode.INVALID_OTP);
        }

        redisTemplate.delete(emailKey);

        if (accountRepository.existsByUsername(regReq.getUsername())) {
            throw new AppException(AuthErrorCode.USERNAME_EXISTED);
        }
        if (accountRepository.existsByEmail(emailKey)) {
            throw new AppException(AuthErrorCode.EMAIL_EXISTED);
        }

        Account account = accountMapper.toAccount(regReq);
        account.setPasswordHash(passwordEncoder.encode(regReq.getPassword()));
        account.setStatus(1);

        Role accountRole = roleRepository.findById("ROLE_USER")
                .orElseThrow(() -> new AppException(AuthErrorCode.ROLE_NOT_FOUND));

        HashSet<Role> roles = new HashSet<>();
        roles.add(accountRole);

        account.setRoles(roles);

        account = accountRepository.saveAndFlush(account);

        UserCreationRequest userCreationRequest = UserCreationRequest.builder().accountId(account.getAccountId()).fullName(regReq.getFullName()).phoneNumber(regReq.getPhoneNumber()).address(regReq.getAddress()).gender(regReq.getGender()).dateOfBirth(regReq.getDateOfBirth()).email(regReq.getEmail()).identityCard(regReq.getIdentityCard()).build();

        userProfileClient.createProfile(userCreationRequest);

        return accountMapper.toRegisterResponse(account);
    }

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        Account account = accountRepository.findByUsername(request.getUsername()).orElseThrow(() -> new AppException(GlobalErrorCode.UNAUTHENTICATED));

        boolean authenticate = passwordEncoder.matches(request.getPassword(), account.getPasswordHash());

        if (!authenticate) {
            throw new AppException(GlobalErrorCode.UNAUTHENTICATED);
        }
        var token = jwtService.generateToken(account);

        return AuthenticationResponse.builder().authenticate(true).token(token).build();
    }

//    public RegisterResponse myInfo() {
//        var context = SecurityContextHolder.getContext();
//
//        String name = context.getAuthentication().getName();
//
//        Account account = accountRepository.findByUsername(name).orElseThrow(() -> new AppException(AuthErrorCode.USERNAME_EXISTED));
//
//        return accountMapper.toRegisterResponse(account);
//    }

    public List<Account> getAllAccount() {
        return accountRepository.findAll();
    }

}