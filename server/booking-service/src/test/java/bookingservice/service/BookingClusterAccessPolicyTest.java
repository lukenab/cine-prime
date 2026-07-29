package bookingservice.service;

import movie.theater.common.exception.AppException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BookingClusterAccessPolicyTest {
    private final BookingClusterAccessPolicy policy = new BookingClusterAccessPolicy();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void adminMayOperateAnyCluster() {
        authenticate("ADMIN", Map.of());

        assertThatCode(() -> policy.requireAccess(43L)).doesNotThrowAnyException();
    }

    @Test
    void employeeMayOperateOnlyAssignedCluster() {
        authenticate("EMPLOYEE", Map.of("cinemaClusterIds", List.of(43L, 44L)));

        assertThatCode(() -> policy.requireAccess(43L)).doesNotThrowAnyException();
        assertThatThrownBy(() -> policy.requireAccess(99L))
                .isInstanceOf(AppException.class);
    }

    @Test
    void customerCannotUseClusterOperations() {
        authenticate("CUSTOMER", Map.of("cinemaClusterId", 43L));

        assertThatThrownBy(() -> policy.requireAccess(43L))
                .isInstanceOf(AppException.class);
    }

    private void authenticate(String role, Map<String, Object> claims) {
        Jwt.Builder jwtBuilder = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .claim("accountId", "account-1")
                .claim("role", role);
        claims.forEach(jwtBuilder::claim);

        JwtAuthenticationToken authentication = new JwtAuthenticationToken(
                jwtBuilder.build(),
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
    }
}
