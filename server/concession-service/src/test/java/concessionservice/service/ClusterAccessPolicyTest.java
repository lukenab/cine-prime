package concessionservice.service;

import movie.theater.common.exception.AppException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ClusterAccessPolicyTest {
    private final ClusterAccessPolicy policy = new ClusterAccessPolicy();

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void branchManagerCannotCrossAssignedBranch() {
        authenticate("BRANCH_MANAGER", Map.of("cinemaClusterIds", List.of(81L)));

        assertThatCode(() -> policy.requireAccess(81L)).doesNotThrowAnyException();
        assertThatThrownBy(() -> policy.requireAccess(82L)).isInstanceOf(AppException.class);
    }

    @Test
    void memberCannotUseStaffBranchClaim() {
        authenticate("MEMBER", Map.of("cinemaClusterId", 81L));
        assertThatThrownBy(() -> policy.requireAccess(81L)).isInstanceOf(AppException.class);
    }

    private void authenticate(String role, Map<String, Object> claims) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("accountId", "account-1");
        claims.forEach(builder::claim);
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                builder.build(), List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
