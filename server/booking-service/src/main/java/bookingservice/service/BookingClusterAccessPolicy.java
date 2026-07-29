package bookingservice.service;

import movie.theater.common.exception.AppException;
import movie.theater.common.security.JwtSecurityUtils;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

import static bookingservice.exception.BookingErrorCode.CLUSTER_ACCESS_DENIED;

@Component
public class BookingClusterAccessPolicy {

    public void requireAccess(Long clusterId) {
        if (clusterId == null) {
            throw new AppException(CLUSTER_ACCESS_DENIED);
        }
        if (isAnyRole("ADMIN", "SUPER_ADMIN")) {
            return;
        }
        if (!isAnyRole("EMPLOYEE")) {
            throw new AppException(CLUSTER_ACCESS_DENIED);
        }

        Jwt jwt = JwtSecurityUtils.getCurrentJwt();
        if (jwt == null || !extractClusterIds(jwt).contains(clusterId)) {
            throw new AppException(CLUSTER_ACCESS_DENIED);
        }
    }

    private boolean isAnyRole(String... roles) {
        return Arrays.stream(roles).anyMatch(role ->
                JwtSecurityUtils.hasRole(role) || JwtSecurityUtils.hasRole("ROLE_" + role));
    }

    private Set<Long> extractClusterIds(Jwt jwt) {
        Set<Long> result = new HashSet<>();
        for (String claimName : new String[]{
                "cinemaClusterIds", "clusterIds", "cinemaClusterId", "clusterId"}) {
            addClaim(result, jwt.getClaim(claimName));
        }
        return result;
    }

    private void addClaim(Set<Long> result, Object value) {
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
        String text = value.toString();
        Arrays.stream(text.split("[,\\s]+"))
                .filter(part -> !part.isBlank())
                .forEach(part -> {
                    try {
                        result.add(Long.parseLong(part));
                    } catch (NumberFormatException ignored) {
                        // Non-numeric cluster claims are not trusted as cluster identifiers.
                    }
                });
    }
}
