package movieservice.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.authentication.TestingAuthenticationToken;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AutoShowtimeManualExecutionAccessTest {

    @Test
    void superAdminMayProcessInProduction() {
        AutoShowtimeManualExecutionAccess access = new AutoShowtimeManualExecutionAccess(
                new MockEnvironment().withProperty("spring.profiles.active", "prod"), false);

        assertTrue(access.canExecute(authentication("ROLE_SUPER_ADMIN")));
    }

    @Test
    void adminCannotProcessInProduction() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        AutoShowtimeManualExecutionAccess access = new AutoShowtimeManualExecutionAccess(environment, false);

        assertFalse(access.canExecute(authentication("ROLE_ADMIN")));
    }

    @Test
    void adminMayProcessInDemoProfile() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("demo");
        AutoShowtimeManualExecutionAccess access = new AutoShowtimeManualExecutionAccess(environment, false);

        assertTrue(access.canExecute(authentication("ROLE_ADMIN")));
    }

    @Test
    void employeeCannotUseManualExecutionEvenWhenEnabled() {
        AutoShowtimeManualExecutionAccess access = new AutoShowtimeManualExecutionAccess(
                new MockEnvironment(), true);

        assertFalse(access.canExecute(authentication("ROLE_EMPLOYEE")));
    }

    private TestingAuthenticationToken authentication(String authority) {
        return new TestingAuthenticationToken("operator", "n/a", authority);
    }
}
