package movie.theater.common.security;

import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

/**
 * Resolves branch assignments exclusively from a verified JWT principal.
 * Request parameters and headers are deliberately not accepted as authority.
 */
public final class JwtBranchScope {
    private static final Set<String> CLUSTER_CLAIMS = Set.of(
            "cinemaClusterIds", "clusterIds", "cinemaClusterId", "clusterId");

    private JwtBranchScope() {
    }

    public static boolean canAccess(Long clusterId) {
        if (clusterId == null) {
            return false;
        }
        if (hasAnyRole("ADMIN", "SUPER_ADMIN")) {
            return true;
        }
        if (!hasAnyRole("BRANCH_MANAGER", "EMPLOYEE")) {
            return false;
        }
        Jwt jwt = JwtSecurityUtils.getCurrentJwt();
        return jwt != null && assignedClusterIds(jwt).contains(clusterId);
    }

    public static Set<Long> assignedClusterIds(Jwt jwt) {
        Set<Long> result = new HashSet<>();
        if (jwt == null) {
            return Set.of();
        }
        CLUSTER_CLAIMS.forEach(claim -> addClaim(result, jwt.getClaim(claim)));
        return Set.copyOf(result);
    }

    private static boolean hasAnyRole(String... roles) {
        return Arrays.stream(roles).anyMatch(role ->
                JwtSecurityUtils.hasRole(role) || JwtSecurityUtils.hasRole("ROLE_" + role));
    }

    private static void addClaim(Set<Long> result, Object value) {
        if (value == null) {
            return;
        }
        if (value instanceof Collection<?> collection) {
            collection.forEach(item -> addClaim(result, item));
            return;
        }
        if (value instanceof Number number) {
            result.add(number.longValue());
            return;
        }
        Arrays.stream(value.toString().split("[,\\s]+"))
                .filter(part -> !part.isBlank())
                .forEach(part -> {
                    try {
                        result.add(Long.parseLong(part));
                    } catch (NumberFormatException ignored) {
                        // Fail closed: only numeric IDs from the signed token are accepted.
                    }
                });
    }
}
