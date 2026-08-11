package authservice.service;

import authservice.dto.response.LoginResponse;
import authservice.entity.Account;
import authservice.entity.AccountIdentity;
import authservice.entity.Role;
import authservice.event.UserRegisteredEvent;
import authservice.messaging.AuthEventPublisher;
import authservice.repository.AccountIdentityRepository;
import authservice.repository.AccountRepository;
import authservice.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class GoogleAuthenticationServiceTest {

    @Test
    void createsMemberIdentityAndIssuesCinePrimeTokenForNewGoogleUser() {
        GoogleIdentityTokenVerifier verifier = mock(GoogleIdentityTokenVerifier.class);
        AccountIdentityRepository identities = mock(AccountIdentityRepository.class);
        AccountRepository accounts = mock(AccountRepository.class);
        RoleRepository roles = mock(RoleRepository.class);
        PasswordEncoder passwords = mock(PasswordEncoder.class);
        AuthEventPublisher publisher = mock(AuthEventPublisher.class);
        AuthenticationService authentication = mock(AuthenticationService.class);

        var principal = new GoogleIdentityTokenVerifier.GooglePrincipal(
                "google-subject-1", "member@example.com", "CinePrime Member", "https://example.com/avatar.jpg");
        Role memberRole = Role.builder().roleName("MEMBER").build();
        LoginResponse expected = LoginResponse.builder().authenticated(true).token("cineprime-jwt").build();

        when(verifier.verify("google-credential")).thenReturn(principal);
        when(identities.findByProviderAndProviderSubject("GOOGLE", "google-subject-1"))
                .thenReturn(Optional.empty());
        when(accounts.findByEmail("member@example.com")).thenReturn(Optional.empty());
        when(roles.findById("MEMBER")).thenReturn(Optional.of(memberRole));
        when(accounts.existsByUsername("google_member")).thenReturn(false);
        when(passwords.encode(any())).thenReturn("random-password-hash");
        when(accounts.save(any(Account.class))).thenAnswer(invocation -> {
            Account account = invocation.getArgument(0);
            account.setAccountId("account-1");
            return account;
        });
        when(authentication.completeFederatedAuthentication(any(Account.class), eq("GOOGLE")))
                .thenReturn(expected);

        GoogleAuthenticationService service = new GoogleAuthenticationService(
                verifier, identities, accounts, roles, passwords, publisher, authentication);

        LoginResponse actual = service.authenticate("google-credential");

        assertThat(actual.getToken()).isEqualTo("cineprime-jwt");
        ArgumentCaptor<Account> accountCaptor = ArgumentCaptor.forClass(Account.class);
        verify(accounts).save(accountCaptor.capture());
        assertThat(accountCaptor.getValue().isLocalLoginEnabled()).isFalse();
        assertThat(accountCaptor.getValue().getRoles()).extracting(Role::getRoleName).containsExactly("MEMBER");

        ArgumentCaptor<AccountIdentity> identityCaptor = ArgumentCaptor.forClass(AccountIdentity.class);
        verify(identities).save(identityCaptor.capture());
        assertThat(identityCaptor.getValue().getProviderSubject()).isEqualTo("google-subject-1");

        ArgumentCaptor<UserRegisteredEvent> eventCaptor = ArgumentCaptor.forClass(UserRegisteredEvent.class);
        verify(publisher).sendRegisteredEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().getFullName()).isEqualTo("CinePrime Member");
    }
}
