package movieservice.controller;

import movieservice.dto.request.ProductionCompanyRequest;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * create/update were ADMIN-only despite a production company being added inline while
 * creating/editing a movie in MovieEditorPage (both ADMIN and EMPLOYEE use it) - an EMPLOYEE
 * hit a 403 on POST /api/companies whenever a not-yet-imported company was typed into the
 * credits form, blocking movie creation entirely. Same reflection-based approach as
 * PersonControllerAuthorizationTest, which had the identical gap fixed earlier.
 */
class ProductionCompanyControllerAuthorizationTest {

    @Test
    void createAndUpdateRequireAdminOrEmployee() throws NoSuchMethodException {
        Method create = ProductionCompanyController.class.getDeclaredMethod("create", ProductionCompanyRequest.class);
        Method update = ProductionCompanyController.class.getDeclaredMethod("update", Long.class, ProductionCompanyRequest.class);

        assertEquals("hasAnyRole('ADMIN', 'EMPLOYEE')", create.getAnnotation(PreAuthorize.class).value());
        assertEquals("hasAnyRole('ADMIN', 'EMPLOYEE')", update.getAnnotation(PreAuthorize.class).value());
    }

    @Test
    void deleteIsAdminOnly() throws NoSuchMethodException {
        Method delete = ProductionCompanyController.class.getDeclaredMethod("delete", Long.class);

        assertEquals("hasRole('ADMIN')", delete.getAnnotation(PreAuthorize.class).value());
    }
}
