package authservice.service;

import authservice.dto.request.RegisterRequest;
import authservice.dto.request.UserCreationRequest;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthenticationService {
    AccountRepository accountRepository;
    RoleRepository roleRepository;
    AccountMapper accountMapper;
    PasswordEncoder passwordEncoder;
    UserProfileClient userProfileClient;

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

        account = accountRepository.save(account);

        UserCreationRequest userCreationRequest = UserCreationRequest.builder()
                .accountId(account.getAccountId())
                .fullName(request.getFullName())
                .phoneNumber(request.getPhoneNumber())
                .address(request.getAddress())
                .gender(request.getGender())
                .address(request.getAddress())
                .identityCard(request.getIdentityCard())
                .build();

        userProfileClient.createProfile(userCreationRequest);

        return accountMapper.toRegisterResponse(account);
    }
}
