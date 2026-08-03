package authservice.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class SecurityConfigTest {

    @Test
    void mapsRoleScopeWithoutAddingAnotherPrefix() {
        SecurityConfig config = new SecurityConfig(mock(CustomJwtDecoder.class));
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "HS512")
                .subject("admin")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .claim("scope", "ROLE_ADMIN ACCOUNT_READ")
                .build();

        var authentication = config.jwtAuthenticationConverter().convert(jwt);

        assertThat(authentication.getAuthorities())
                .extracting("authority")
                .containsExactlyInAnyOrder("ROLE_ADMIN", "ACCOUNT_READ")
                .doesNotContain("SCOPE_ROLE_ADMIN", "ROLE_ROLE_ADMIN");
    }
}
