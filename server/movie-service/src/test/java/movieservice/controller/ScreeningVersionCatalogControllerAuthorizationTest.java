package movieservice.controller;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ScreeningVersionCatalogControllerAuthorizationTest {

    @Test
    void catalogueReadIsAvailableToAdminAndProgrammingOperator() throws NoSuchMethodException {
        PreAuthorize authorization = ScreeningVersionCatalogController.class
                .getDeclaredMethod(
                        "search",
                        String.class,
                        movieservice.enums.ScreeningVersionStatus.class,
                        Integer.class,
                        boolean.class)
                .getAnnotation(PreAuthorize.class);

        assertEquals("hasAnyRole('ADMIN', 'PROGRAMMING_OPERATOR')", authorization.value());
    }
}
