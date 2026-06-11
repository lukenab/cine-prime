    package authservice.service;

    import authservice.dto.request.AuthenticationRequest;
    import authservice.dto.request.RegisterRequest;
    import authservice.dto.request.UserCreationRequest;
    import authservice.dto.response.AuthenticationResponse;
    import authservice.dto.response.RegisterResponse;
    import authservice.entity.Account;
    import authservice.entity.Role;
    import authservice.mapper.AccountMapper;
    import authservice.repository.AccountRepository;
    import authservice.repository.RoleRepository;
    import authservice.repository.UserProfileClient;
    import com.nimbusds.jose.*;
    import jakarta.transaction.Transactional;
    import lombok.AccessLevel;
    import lombok.RequiredArgsConstructor;
    import lombok.experimental.FieldDefaults;
    import lombok.extern.slf4j.Slf4j;
    import movie.theater.common.exception.AppException;
    import movie.theater.common.exception.ErrorCode;
    import org.springframework.security.crypto.password.PasswordEncoder;
    import org.springframework.stereotype.Service;
    import movie.theater.common.exception.ErrorCode;


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

        @Transactional
        public RegisterResponse registerAccount(RegisterRequest request){

            if(accountRepository.existsByUsername(request.getUsername())){
                throw new AppException(ErrorCode.USERNAME_EXISTED);
            }

            if(accountRepository.existsByEmail(request.getEmail())) {
                throw new AppException(ErrorCode.EMAIL_EXISTED);
            }

            Account account = accountMapper.toAccount(request);
            account.setPasswordHash(passwordEncoder.encode(request.getPassword()));
            account.setStatus(1);

            Role accountRole = roleRepository.findByRoleName("ROLE_USER")
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
            account.setRole(accountRole);

            account = accountRepository.saveAndFlush(account);

            UserCreationRequest userCreationRequest = UserCreationRequest.builder()
                    .accountId(account.getAccountId())
                    .fullName(request.getFullName())
                    .phoneNumber(request.getPhoneNumber())
                    .address(request.getAddress())
                    .gender(request.getGender())
                    .dateOfBirth(request.getDateOfBirth())
                    .email(request.getEmail())
                    .identityCard(request.getIdentityCard())
                    .build();

            userProfileClient.createProfile(userCreationRequest);

            return accountMapper.toRegisterResponse(account);
        }

        public AuthenticationResponse authenticate(AuthenticationRequest request){
            Account account = accountRepository.findByUsername(request.getUsername())
                    .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));

            boolean authenticate = passwordEncoder.matches(request.getPassword(), account.getPasswordHash());

            if(!authenticate){
                throw new AppException(ErrorCode.UNAUTHENTICATED);
            }
            var token = jwtService.generateToken(account);

            return AuthenticationResponse.builder()
                    .authenticate(true)
                    .token(token)
                    .build();
        }
    }