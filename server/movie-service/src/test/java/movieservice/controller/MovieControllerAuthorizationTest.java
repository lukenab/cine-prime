package movieservice.controller;

import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.RejectRequest;
import movieservice.dto.request.UpdateMovieRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;
import java.time.LocalDate;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * `[Backend] Separate public and internal movie catalog APIs`: the internal catalog
 * (findById/getPage/getAll and every mutation/lifecycle command) must require ADMIN or
 * EMPLOYEE, while the public catalog (getPublic/getPublicById) must carry no method-security
 * annotation at all - it is reachable by anonymous/CUSTOMER callers by design, with visibility
 * enforced by MovieService's isPubliclyVisible() predicate instead of a role check. Same
 * reflection-based approach as TmdbControllerAuthorizationTest.
 */
class MovieControllerAuthorizationTest {

    private static final String ADMIN_OR_EMPLOYEE = "hasRole('ADMIN') or hasRole('EMPLOYEE')";

    static Stream<Arguments> internalEndpointsRequiringAdminOrEmployee() {
        return Stream.of(
                Arguments.of("findById", new Class<?>[]{Long.class, String.class}),
                Arguments.of("getPage", new Class<?>[]{int.class, int.class, movieservice.enums.MovieStatus.class, Long.class, LocalDate.class}),
                Arguments.of("getAll", new Class<?>[]{}),
                Arguments.of("createMovie", new Class<?>[]{CreateMovieRequest.class}),
                Arguments.of("updateMovie", new Class<?>[]{Long.class, UpdateMovieRequest.class}),
                Arguments.of("submit", new Class<?>[]{Long.class}),
                Arguments.of("startRevision", new Class<?>[]{Long.class}),
                Arguments.of("uploadImage", new Class<?>[]{org.springframework.web.multipart.MultipartFile.class})
        );
    }

    @ParameterizedTest
    @MethodSource("internalEndpointsRequiringAdminOrEmployee")
    void internalCatalogEndpointsRequireAdminOrEmployee(String methodName, Class<?>[] parameterTypes)
            throws NoSuchMethodException {
        Method method = MovieController.class.getDeclaredMethod(methodName, parameterTypes);

        assertEquals(ADMIN_OR_EMPLOYEE, method.getAnnotation(PreAuthorize.class).value());
    }

    @Test
    void approveRequestChangesAndArchiveRemainAdminOnly() throws NoSuchMethodException {
        assertEquals("hasRole('ADMIN')",
                MovieController.class.getDeclaredMethod("approve", Long.class).getAnnotation(PreAuthorize.class).value());
        assertEquals("hasRole('ADMIN')",
                MovieController.class.getDeclaredMethod("requestChanges", Long.class, RejectRequest.class)
                        .getAnnotation(PreAuthorize.class).value());
        assertEquals("hasRole('ADMIN')",
                MovieController.class.getDeclaredMethod("archive", Long.class).getAnnotation(PreAuthorize.class).value());
    }

    @Test
    void publicListHasNoMethodSecurityAnnotation() throws NoSuchMethodException {
        Method method = MovieController.class.getDeclaredMethod("getPublic", Long.class);

        assertNull(method.getAnnotation(PreAuthorize.class),
                "GET /api/movies/public must stay reachable by anonymous/CUSTOMER callers - " +
                        "visibility is enforced by MovieService.isPubliclyVisible(), not a role check");
    }

    @Test
    void publicDetailHasNoMethodSecurityAnnotation() throws NoSuchMethodException {
        Method method = MovieController.class.getDeclaredMethod("getPublicById", Long.class, Long.class);

        assertNull(method.getAnnotation(PreAuthorize.class),
                "GET /api/movies/public/{id} must stay reachable by anonymous/CUSTOMER callers, " +
                        "same as the public list it shares a visibility predicate with");
    }
}
