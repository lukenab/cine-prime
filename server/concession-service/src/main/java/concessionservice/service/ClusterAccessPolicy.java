package concessionservice.service;

import movie.theater.common.exception.AppException;
import movie.theater.common.security.JwtSecurityUtils;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.*;

import static concessionservice.exception.ConcessionErrorCode.CLUSTER_ACCESS_DENIED;

@Component
public class ClusterAccessPolicy {
    public void requireAccess(Long clusterId) {
        if (clusterId == null) throw new AppException(CLUSTER_ACCESS_DENIED);
        if (hasAnyRole("ADMIN", "SUPER_ADMIN")) return;
        if (!hasAnyRole("EMPLOYEE")) throw new AppException(CLUSTER_ACCESS_DENIED);

        Jwt jwt = JwtSecurityUtils.getCurrentJwt();
        if (jwt == null || !extractClusterIds(jwt).contains(clusterId)) {
            throw new AppException(CLUSTER_ACCESS_DENIED);
        }
    }

    private boolean hasAnyRole(String... roles) {
        return Arrays.stream(roles).anyMatch(role ->
                JwtSecurityUtils.hasRole(role) || JwtSecurityUtils.hasRole("ROLE_" + role));
    }

    private Set<Long> extractClusterIds(Jwt jwt) {
        Set<Long> result = new HashSet<>();
        for (String claim : new String[]{
                "cinemaClusterIds", "clusterIds", "cinemaClusterId", "clusterId"}) {
            addClaim(result, jwt.getClaim(claim));
        }
        return result;
    }

    private void addClaim(Set<Long> result, Object value) {
        if (value == null) return;
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
                        // Only numeric cluster claims are trusted.
                    }
                });
    }
}
