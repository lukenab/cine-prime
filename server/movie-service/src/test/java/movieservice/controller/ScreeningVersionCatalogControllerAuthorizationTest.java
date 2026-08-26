package movieservice.controller;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ScreeningVersionCatalogControllerAuthorizationTest {

    @Test
    void catalogueReadUsesMovieReadCapability() throws NoSuchMethodException {
        PreAuthorize authorization = ScreeningVersionCatalogController.class
                .getDeclaredMethod(
                        "search",
                        String.class,
                        movieservice.enums.ScreeningVersionStatus.class,
                        Integer.class,
                        List.class,
                        boolean.class)
                .getAnnotation(PreAuthorize.class);

        assertEquals("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_READ')", authorization.value());
    }

    @Test
    void pagedCatalogueReadUsesMovieReadCapability() throws NoSuchMethodException {
        PreAuthorize authorization = ScreeningVersionCatalogController.class
                .getDeclaredMethod(
                        "searchPage",
                        String.class,
                        movieservice.enums.ScreeningVersionStatus.class,
                        Integer.class,
                        String.class,
                        int.class,
                        int.class)
                .getAnnotation(PreAuthorize.class);

        assertEquals("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_READ')", authorization.value());
    }
}
