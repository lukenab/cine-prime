package movieservice.controller;

import movieservice.dto.request.PersonRequest;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * `[Backend] Enforce movie-service endpoint authorization matrix`: create/update/delete had no
 * `@PreAuthorize` at all before this fix, so any authenticated CUSTOMER could mutate cast/crew
 * reference data. Same reflection-based approach as TmdbControllerAuthorizationTest.
 */
class PersonControllerAuthorizationTest {

    @Test
    void createAndUpdateRequireAdminOrEmployee() throws NoSuchMethodException {
        Method create = PersonController.class.getDeclaredMethod("create", PersonRequest.class);
        Method update = PersonController.class.getDeclaredMethod("update", Long.class, PersonRequest.class);

        assertEquals("hasAnyRole('ADMIN', 'EMPLOYEE')", create.getAnnotation(PreAuthorize.class).value());
        assertEquals("hasAnyRole('ADMIN', 'EMPLOYEE')", update.getAnnotation(PreAuthorize.class).value());
    }

    @Test
    void deleteIsAdminOnly() throws NoSuchMethodException {
        Method delete = PersonController.class.getDeclaredMethod("delete", Long.class);

        assertEquals("hasRole('ADMIN')", delete.getAnnotation(PreAuthorize.class).value());
    }
}
