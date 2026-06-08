package authservice.service;

import authservice.dto.request.RegisterRequest;
import authservice.dto.response.RegisterResponse;
import authservice.entity.Account;
import authservice.mapper.AccountMapper;
import authservice.repository.AccountRepository;
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
    AccountMapper accountMapper;
    PasswordEncoder passwordEncoder;

    public RegisterResponse registerAccount(RegisterRequest request){
        if(accountRepository.existsByUsername(request.getUsername())){
            throw new RuntimeException("Username has already existed!");
        }

        Account account = accountMapper.toAccount(request);
        account.setPasswordHash(passwordEncoder.encode(request.getPasswordHash()));

        return accountMapper.toRegisterResponse(accountRepository.save(account));
    }
}
