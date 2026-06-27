package movie.theater.common.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Arrays;
import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;

public final class JwtSecurityUtils {

    private JwtSecurityUtils() {
    }

    public static Jwt getCurrentJwt() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt;
        }
        return null;
    }

    public static String getCurrentAccountId() {
        Jwt jwt = getCurrentJwt();
        return jwt != null ? jwt.getClaimAsString("accountId") : null;
    }

    public static Set<String> getCurrentRoles() {
        Jwt jwt = getCurrentJwt();
        if (jwt == null) {
            return Collections.emptySet();
        }

        String roleClaim = jwt.getClaimAsString("role");
        if (roleClaim == null || roleClaim.isBlank()) {
            return Collections.emptySet();
        }

        return Arrays.stream(roleClaim.split("\\s+")).filter(role -> !role.isBlank()).collect(Collectors.toUnmodifiableSet());
    }

    public static boolean hasRole(String role) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null) {
            boolean granted = authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority).anyMatch(role::equals);
            if (granted) {
                return true;
            }
        }

        return getCurrentRoles().contains(role);
    }
}
