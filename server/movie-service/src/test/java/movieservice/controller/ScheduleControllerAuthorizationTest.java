package movieservice.controller;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ScheduleControllerAuthorizationTest {

    private static final String INTERNAL_READ_AUTHORITIES =
            "hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'SHOWTIME_READ')";

    @Test
    void internalScheduleListAllowsReadOnlyShowtimeCapability() throws NoSuchMethodException {
        var method = ScheduleController.class.getDeclaredMethod("getAllInternal");

        assertEquals(INTERNAL_READ_AUTHORITIES, method.getAnnotation(PreAuthorize.class).value());
    }

    @Test
    void internalScheduleDetailAllowsReadOnlyShowtimeCapability() throws NoSuchMethodException {
        var method = ScheduleController.class.getDeclaredMethod("getByIdInternal", Long.class);

        assertEquals(INTERNAL_READ_AUTHORITIES, method.getAnnotation(PreAuthorize.class).value());
    }
}
