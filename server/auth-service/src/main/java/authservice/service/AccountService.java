package authservice.service;

import authservice.dto.request.AccountUpdateRequest;
import authservice.dto.request.RegisterRequest;
import authservice.event.UserRegisteredEvent;
import authservice.event.UserUpdatedEvent;
import authservice.dto.response.AccountResponse;
import authservice.entity.Account;
import authservice.entity.Role;
import authservice.exception.AuthErrorCode;
import authservice.mapper.AccountMapper;
import authservice.producer.UserEventProducer;
import authservice.repository.AccountRepository;
import authservice.repository.RoleRepository;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AccountService {
    AccountRepository accountRepository;
    AccountMapper accountMapper;
    PasswordEncoder passwordEncoder;
    RoleRepository roleRepository;
    UserEventProducer userEventProducer;


//    @PreAuthorize("hasRole('ADMIN')")
//    @PreAuthorize("hasAuthority('CREATE_DATA')")
    public List<AccountResponse> getAllAccount() {
        return accountMapper.toAccountResponseList(accountRepository.findAll());
    }

    public AccountResponse getAccountById(String accountId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new AppException(AuthErrorCode.ACCOUNT_NOT_FOUND));
        return accountMapper.toAccountResponse(account);
    }

    @Transactional
    public AccountResponse updateAccount(String accountId, AccountUpdateRequest request) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new AppException(AuthErrorCode.ACCOUNT_NOT_FOUND));

        accountMapper.updateAccount(request, account);

        if (StringUtils.hasText(request.getPassword())) {
            account.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }

        if (!CollectionUtils.isEmpty(request.getRoles())) {
            List<Role> roles = roleRepository.findAllById(request.getRoles());
            account.setRoles(new HashSet<>(roles));
        }

        accountRepository.save(account);

        UserUpdatedEvent userUpdatedEvent = UserUpdatedEvent.builder()
                .accountId(accountId)
                .fullName(request.getFullName())
                .phoneNumber(request.getPhoneNumber())
                .dateOfBirth(request.getDateOfBirth())
                .gender(request.getGender())
                .address(request.getAddress())
                .identityCard(request.getIdentityCard())
                .build();

        userEventProducer.sendUpdatedEvent(userUpdatedEvent);

        return accountMapper.toAccountResponse(account);
    }

    @Transactional
    public AccountResponse createAccount(RegisterRequest request) {
        String emailKey = request.getEmail().trim().toLowerCase();

        if (accountRepository.existsByUsername(request.getUsername())) {
            throw new AppException(AuthErrorCode.USERNAME_EXISTED);
        }
        if (accountRepository.existsByEmail(emailKey)) {
            throw new AppException(AuthErrorCode.EMAIL_EXISTED);
        }

        Account account = accountMapper.toAccount(request);
        account.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        account.setStatus(1);

        String requestedRole = (request.getRole() != null && !request.getRole().isBlank())
                ? request.getRole().toUpperCase().trim()
                : "USER";

        Role accountRole = roleRepository.findById(requestedRole)
                .orElseThrow(() -> new AppException(AuthErrorCode.ROLE_NOT_FOUND));
        
        HashSet<Role> roles = new HashSet<>();
        roles.add(accountRole);
        account.setRoles(roles);

        account = accountRepository.saveAndFlush(account);

        // 5. Bắn Event sang cho user-service tạo Profile
        UserRegisteredEvent userRegisteredEvent = UserRegisteredEvent.builder()
                .accountId(account.getAccountId())
                .fullName(request.getFullName())
                .phoneNumber(request.getPhoneNumber())
                .address(request.getAddress())
                .gender(request.getGender())
                .dateOfBirth(request.getDateOfBirth())
                .email(emailKey)
                .identityCard(request.getIdentityCard())
                .build();

        userEventProducer.sendRegisteredEvent(userRegisteredEvent);

        return accountMapper.toAccountResponse(account);
    }


    public AccountResponse myInfo() {
        var context = SecurityContextHolder.getContext();

        String name = context.getAuthentication().getName();

        Account account = accountRepository.findByUsername(name).orElseThrow(() -> new AppException(AuthErrorCode.USERNAME_EXISTED));

        return accountMapper.toAccountResponse(account);
    }


}
