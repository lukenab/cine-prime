package authservice.service;

import authservice.dto.request.LoginRequest;
import authservice.entity.Account;
import authservice.entity.Role;
import authservice.enums.AccountStatus;
import authservice.repository.AccountRepository;
import authservice.repository.AuthTokenRepository;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthenticationServiceTest {

    @Test
    void authenticatesWithWorkEmailIgnoringCaseAndWhitespace() throws Exception {
        AccountRepository accounts = mock(AccountRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        JwtService jwtService = mock(JwtService.class);
        AuthTokenRepository tokens = mock(AuthTokenRepository.class);
        AuditLogService audit = mock(AuditLogService.class);
        AbuseProtectionService abuseProtection = mock(AbuseProtectionService.class);
        Account account = Account.builder()
                .accountId("account-1")
                .username("employee.001")
                .email("staff@cineprime.vn")
                .passwordHash("encoded")
                .status(AccountStatus.ACTIVE)
                .build();

        when(accounts.findByUsernameIgnoreCaseOrEmailIgnoreCase("staff@cineprime.vn", "staff@cineprime.vn"))
                .thenReturn(Optional.of(account));
        when(passwordEncoder.matches("Password@123", "encoded")).thenReturn(true);
        when(jwtService.generateToken(account)).thenReturn(jwt());

        AuthenticationService service = new AuthenticationService(
                accounts, passwordEncoder, jwtService, tokens, audit, abuseProtection);

        var result = service.authenticate(LoginRequest.builder()
                .username("  STAFF@CINEPRIME.VN ")
                .password("Password@123")
                .build());

        assertThat(result.isAuthenticated()).isTrue();
        verify(abuseProtection).guardLogin("staff@cineprime.vn");
        verify(abuseProtection).loginSucceeded("staff@cineprime.vn");
    }

    @Test
    void staffLoginSucceedsFromLocalProjectionWithoutUserService() throws Exception {
        AccountRepository accounts = mock(AccountRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        AuthTokenRepository tokens = mock(AuthTokenRepository.class);
        AuditLogService audit = mock(AuditLogService.class);
        AbuseProtectionService abuseProtection = mock(AbuseProtectionService.class);
        StaffAccessProjectionService projections = mock(StaffAccessProjectionService.class);
        Account account = Account.builder()
                .accountId("account-branch-manager")
                .username("branch.manager")
                .email("branch.manager@cineprime.vn")
                .passwordHash("encoded")
                .localLoginEnabled(true)
                .status(AccountStatus.ACTIVE)
                .roles(Set.of(Role.builder()
                        .roleName("BRANCH_MANAGER")
                        .permissions(Set.of())
                        .build()))
                .build();
        when(accounts.findByUsernameIgnoreCaseOrEmailIgnoreCase(
                "branch.manager", "branch.manager")).thenReturn(Optional.of(account));
        when(passwordEncoder.matches("Password@123", "encoded")).thenReturn(true);
        when(projections.resolve(account)).thenReturn(
                new StaffAccessProjectionService.StaffAuthorization(
                        true, true, "BRANCH_MANAGER", List.of("81")));
        JwtService localJwt = new JwtService(tokens, projections);
        ReflectionTestUtils.setField(localJwt, "SIGNER_KEY", "a".repeat(64));
        ReflectionTestUtils.setField(localJwt, "VALID_DURATION", 1800L);
        ReflectionTestUtils.setField(localJwt, "REFRESHABLE_DURATION", 36000L);
        AuthenticationService service = new AuthenticationService(
                accounts, passwordEncoder, localJwt, tokens, audit, abuseProtection);

        var response = service.authenticate(LoginRequest.builder()
                .username("branch.manager")
                .password("Password@123")
                .build());

        SignedJWT token = SignedJWT.parse(response.getToken());
        assertThat(response.isAuthenticated()).isTrue();
        assertThat(token.getJWTClaimsSet().getStringClaim("scope"))
                .contains("ROLE_BRANCH_MANAGER");
        assertThat(token.getJWTClaimsSet().getStringListClaim("cinemaClusterIds"))
                .containsExactly("81");
    }

    private String jwt() throws Exception {
        Instant now = Instant.now();
        SignedJWT jwt = new SignedJWT(
                new JWSHeader(JWSAlgorithm.HS256),
                new JWTClaimsSet.Builder()
                        .subject("employee.001")
                        .jwtID("test-jwt-id")
                        .issueTime(Date.from(now))
                        .expirationTime(Date.from(now.plusSeconds(3600)))
                        .build());
        jwt.sign(new MACSigner("01234567890123456789012345678901"));
        return jwt.serialize();
    }
}
