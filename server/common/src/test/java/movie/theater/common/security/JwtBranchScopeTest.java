package movie.theater.common.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class JwtBranchScopeTest {

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void globalAdminCanAccessEveryCluster() {
        authenticate("ADMIN", Map.of());
        assertThat(JwtBranchScope.canAccess(999L)).isTrue();
    }

    @Test
    void branchManagerCanAccessOnlySignedAssignments() {
        authenticate("BRANCH_MANAGER", Map.of("cinemaClusterIds", List.of(81L, 82L)));
        assertThat(JwtBranchScope.canAccess(81L)).isTrue();
        assertThat(JwtBranchScope.canAccess(99L)).isFalse();
    }

    @Test
    void memberCannotEscalateWithAClusterClaim() {
        authenticate("MEMBER", Map.of("cinemaClusterId", 81L));
        assertThat(JwtBranchScope.canAccess(81L)).isFalse();
    }

    @Test
    void malformedOrMissingAssignmentFailsClosed() {
        authenticate("EMPLOYEE", Map.of("clusterIds", "81,not-an-id"));
        assertThat(JwtBranchScope.canAccess(81L)).isTrue();
        assertThat(JwtBranchScope.canAccess(82L)).isFalse();
    }

    private void authenticate(String role, Map<String, Object> claims) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("accountId", "account-1");
        claims.forEach(builder::claim);
        JwtAuthenticationToken authentication = new JwtAuthenticationToken(
                builder.build(), List.of(new SimpleGrantedAuthority("ROLE_" + role)));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
