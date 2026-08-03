package authservice.service;

import authservice.client.UserBranchScopeClient;
import authservice.dto.InternalBranchScopeResponse;
import authservice.entity.Account;
import authservice.entity.Role;
import authservice.repository.AuthTokenRepository;
import com.nimbusds.jwt.SignedJWT;
import movie.theater.common.dto.ApiResponse;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JwtServiceBranchScopeTest {

    @Test
    void branchManagerTokenContainsAuthoritativeUserServiceAssignments() throws Exception {
        AuthTokenRepository tokenRepository = mock(AuthTokenRepository.class);
        UserBranchScopeClient scopeClient = mock(UserBranchScopeClient.class);
        JwtService service = new JwtService(tokenRepository, scopeClient);
        ReflectionTestUtils.setField(service, "SIGNER_KEY", "a".repeat(64));
        ReflectionTestUtils.setField(service, "VALID_DURATION", 1800L);
        ReflectionTestUtils.setField(service, "REFRESHABLE_DURATION", 36000L);
        ReflectionTestUtils.setField(service, "internalServiceKey", "test-internal-key");

        Account manager = Account.builder()
                .accountId("ACC-MANAGER")
                .username("manager")
                .email("manager@example.test")
                .passwordHash("not-used")
                .roles(Set.of(Role.builder()
                        .roleName("BRANCH_MANAGER")
                        .permissions(Set.of())
                        .build()))
                .build();
        when(scopeClient.getBranchScope("ACC-MANAGER", "test-internal-key"))
                .thenReturn(ApiResponse.<InternalBranchScopeResponse>builder()
                        .result(new InternalBranchScopeResponse(List.of("81", "81")))
                        .build());

        SignedJWT token = SignedJWT.parse(service.generateToken(manager));

        assertThat(token.getJWTClaimsSet().getStringListClaim("cinemaClusterIds"))
                .containsExactly("81");
        assertThat(token.getJWTClaimsSet().getStringClaim("scope"))
                .contains("ROLE_BRANCH_MANAGER");
    }
}
