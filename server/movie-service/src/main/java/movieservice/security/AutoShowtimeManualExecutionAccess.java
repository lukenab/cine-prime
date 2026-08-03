package movieservice.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component("autoShowtimeManualExecutionAccess")
public class AutoShowtimeManualExecutionAccess {

    private final Environment environment;
    private final boolean explicitlyEnabled;

    public AutoShowtimeManualExecutionAccess(
            Environment environment,
            @Value("${auto-showtime.manual-execution.enabled:false}") boolean explicitlyEnabled
    ) {
        this.environment = environment;
        this.explicitlyEnabled = explicitlyEnabled;
    }

    /** Production access is SUPER_ADMIN-only; ADMIN is allowed for dev/demo support. */
    public boolean canExecute(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        if (hasAuthority(authentication, "ROLE_SUPER_ADMIN")) {
            return true;
        }
        boolean nonProduction = explicitlyEnabled || environment.acceptsProfiles(
                Profiles.of("dev", "development", "demo", "local")
        );
        return nonProduction && (hasAuthority(authentication, "ROLE_ADMIN")
                || hasAuthority(authentication, "ROLE_PROGRAMMING_OPERATOR"));
    }

    private boolean hasAuthority(Authentication authentication, String authority) {
        return authentication.getAuthorities().stream()
                .anyMatch(granted -> authority.equals(granted.getAuthority()));
    }
}
