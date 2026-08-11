package authservice.service;

import authservice.dto.response.LoginResponse;
import authservice.entity.Account;
import authservice.entity.AccountIdentity;
import authservice.entity.Role;
import authservice.enums.AccountStatus;
import authservice.event.UserRegisteredEvent;
import authservice.exception.AuthErrorCode;
import authservice.messaging.AuthEventPublisher;
import authservice.repository.AccountIdentityRepository;
import authservice.repository.AccountRepository;
import authservice.repository.RoleRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class GoogleAuthenticationService {
    private static final String PROVIDER = "GOOGLE";
    private static final String MEMBER_ROLE = "MEMBER";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final GoogleIdentityTokenVerifier tokenVerifier;
    private final AccountIdentityRepository identityRepository;
    private final AccountRepository accountRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthEventPublisher authEventPublisher;
    private final AuthenticationService authenticationService;

    @Transactional
    public LoginResponse authenticate(String credential) {
        GoogleIdentityTokenVerifier.GooglePrincipal principal = tokenVerifier.verify(credential);

        Account account = identityRepository.findByProviderAndProviderSubject(PROVIDER, principal.subject())
                .map(AccountIdentity::getAccount)
                .orElseGet(() -> createGoogleMember(principal));

        return authenticationService.completeFederatedAuthentication(account, PROVIDER);
    }

    private Account createGoogleMember(GoogleIdentityTokenVerifier.GooglePrincipal principal) {
        if (accountRepository.findByEmail(principal.email()).isPresent()) {
            throw new AppException(AuthErrorCode.GOOGLE_ACCOUNT_LINK_REQUIRED);
        }

        Role memberRole = roleRepository.findById(MEMBER_ROLE)
                .orElseThrow(() -> new AppException(AuthErrorCode.ROLE_NOT_FOUND));

        Account account = accountRepository.save(Account.builder()
                .username(generateUsername(principal.email()))
                .email(principal.email())
                .passwordHash(passwordEncoder.encode(randomPassword()))
                .localLoginEnabled(false)
                .status(AccountStatus.ACTIVE)
                .emailVerifiedAt(LocalDateTime.now())
                .roles(Set.of(memberRole))
                .build());

        identityRepository.save(AccountIdentity.builder()
                .account(account)
                .provider(PROVIDER)
                .providerSubject(principal.subject())
                .providerEmail(principal.email())
                .build());

        authEventPublisher.sendRegisteredEvent(UserRegisteredEvent.builder()
                .accountId(account.getAccountId())
                .email(account.getEmail())
                .fullName(principal.fullName())
                .build());

        return account;
    }

    private String generateUsername(String email) {
        String localPart = email.substring(0, email.indexOf('@'))
                .replaceAll("[^A-Za-z0-9._-]", "")
                .replaceAll("^[._-]+|[._-]+$", "");
        if (localPart.isBlank()) localPart = "member";
        String base = ("google_" + localPart);
        if (base.length() > 42) base = base.substring(0, 42);

        String candidate = base;
        int suffix = 1;
        while (accountRepository.existsByUsername(candidate)) {
            candidate = base + "_" + suffix++;
        }
        return candidate;
    }

    private String randomPassword() {
        byte[] bytes = new byte[48];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
