package userservice.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityConfigTest {

    @Test
    void mapsAuthoritiesExactlyAsIssuedByAuthService() {
        SecurityConfig config = new SecurityConfig();
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "HS512")
                .subject("manager")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .claim("scope", "ROLE_BRANCH_MANAGER EMPLOYEE_READ")
                .build();

        var authentication = config.jwtAuthenticationConverter().convert(jwt);

        assertThat(authentication.getAuthorities())
                .extracting("authority")
                .containsExactlyInAnyOrder("ROLE_BRANCH_MANAGER", "EMPLOYEE_READ")
                .doesNotContain("ROLE_ROLE_BRANCH_MANAGER");
    }
}
