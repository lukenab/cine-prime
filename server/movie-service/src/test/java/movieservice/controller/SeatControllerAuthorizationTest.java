package movieservice.controller;

import movieservice.dto.request.SeatRequest;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * `[Backend] Enforce movie-service endpoint authorization matrix`: updateSeat() edits seat
 * structure (type/price) - not a booking action - and had no `@PreAuthorize` at all before this
 * fix, so any authenticated CUSTOMER could change a seat's type/price.
 */
class SeatControllerAuthorizationTest {

    @Test
    void updateSeatRequiresAdminOrEmployee() throws NoSuchMethodException {
        Method updateSeat = SeatController.class.getDeclaredMethod("updateSeat", long.class, SeatRequest.class);

        assertEquals("hasAnyRole('ADMIN', 'EMPLOYEE')", updateSeat.getAnnotation(PreAuthorize.class).value());
    }

    @Test
    void setSeatStatusRemainsAdminOnly() throws NoSuchMethodException {
        Method setSeatStatus = SeatController.class.getDeclaredMethod("setSeatStatus", long.class, String.class);

        assertEquals("hasRole('ADMIN')", setSeatStatus.getAnnotation(PreAuthorize.class).value());
    }
}
