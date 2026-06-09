    package authservice.service;

    import authservice.dto.request.AuthenticationRequest;
    import authservice.dto.request.RegisterRequest;
    import authservice.dto.request.UserCreationRequest;
    import authservice.dto.response.AuthenticationResponse;
    import authservice.dto.response.RegisterResponse;
    import authservice.entity.Account;
    import authservice.entity.Role;
    import authservice.exception.AppException;
    import authservice.exception.ErrorCode;
    import authservice.mapper.AccountMapper;
    import authservice.repository.AccountRepository;
    import authservice.repository.RoleRepository;
    import authservice.repository.UserProfileClient;
    import com.nimbusds.jose.*;
    import com.nimbusds.jose.crypto.MACSigner;
    import com.nimbusds.jwt.JWTClaimsSet;
    import jakarta.transaction.Transactional;
    import lombok.AccessLevel;
    import lombok.RequiredArgsConstructor;
    import lombok.experimental.FieldDefaults;
    import lombok.experimental.NonFinal;
    import lombok.extern.slf4j.Slf4j;
    import org.springframework.beans.factory.annotation.Value;
    import org.springframework.security.crypto.password.PasswordEncoder;
    import org.springframework.stereotype.Service;
    import org.springframework.util.CollectionUtils;

    import java.nio.charset.StandardCharsets;
    import java.time.Instant;
    import java.time.temporal.ChronoUnit;
    import java.util.Date;
    import java.util.StringJoiner;

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

        @NonFinal
        @Value("${jwt.signerKey}")
        private String SIGNER_KEY;

        @Transactional
        public RegisterResponse registerAccount(RegisterRequest request){

            if(accountRepository.existsByUsername(request.getUsername())){
                throw new RuntimeException("Username has already existed!");
            }

            if(accountRepository.existsByEmail(request.getEmail())) {
                throw new RuntimeException("Email has already existed!");
            }

            Account account = accountMapper.toAccount(request);
            account.setPasswordHash(passwordEncoder.encode(request.getPassword()));
            account.setStatus(1);

            Role accountRole = roleRepository.findByRoleName("ROLE_USER")
                    .orElseThrow(() -> new RuntimeException("Default Role not found"));
            account.setRole(accountRole);

            account = accountRepository.save(account);

            UserCreationRequest userCreationRequest = UserCreationRequest.builder()
                    .accountId(account.getAccountId())
                    .fullName(request.getFullName())
                    .phoneNumber(request.getPhoneNumber())
                    .address(request.getAddress())
                    .gender(request.getGender())
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
            var token = generateToken(account);

            return AuthenticationResponse.builder()
                    .authenticate(true)
                    .token(token)
                    .build();
        }

        public String generateToken(Account account){
            JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);

            JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                    .subject(account.getUsername())
                    .issueTime(new Date())
                    .expirationTime(
                            new Date(Instant.now().plus(1, ChronoUnit.HOURS).toEpochMilli())
                    )
                    .issuer("FPT.com")
                    .claim("scope", buildScope(account))
                    .build();

            Payload payload = new Payload(claimsSet.toJSONObject());

            JWSObject jwsObject = new JWSObject(header, payload);
            try {
                jwsObject.sign(new MACSigner(SIGNER_KEY.getBytes(StandardCharsets.UTF_8)));
                return jwsObject.serialize();
            } catch (JOSEException e) {
                log.error("Fail to generate token", e);
                throw new RuntimeException(e);
            }
        }

        private String buildScope(Account account){
            StringJoiner stringJoiner = new StringJoiner(" ");
            if(account.getRole() != null){
                stringJoiner.add(account.getRole().getRoleName());
            }
            return stringJoiner.toString();
        }
    }
