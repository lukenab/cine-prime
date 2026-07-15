package movieservice.controller;

import movieservice.dto.request.TmdbImportRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TmdbControllerAuthorizationTest {

    private static final String ADMIN_OR_EMPLOYEE = "hasAnyRole('ADMIN', 'EMPLOYEE')";

    static Stream<Arguments> employeeAccessibleEndpoints() {
        return Stream.of(
                Arguments.of("search", new Class<?>[]{String.class}),
                Arguments.of("nowPlaying", new Class<?>[]{String.class, int.class}),
                Arguments.of("upcoming", new Class<?>[]{String.class, int.class}),
                Arguments.of("getDetails", new Class<?>[]{Integer.class}),
                Arguments.of("importMovie", new Class<?>[]{TmdbImportRequest.class})
        );
    }

    @ParameterizedTest
    @MethodSource("employeeAccessibleEndpoints")
    void tmdbMovieWorkflowAllowsAdminAndEmployee(String methodName, Class<?>[] parameterTypes)
            throws NoSuchMethodException {
        Method method = TmdbController.class.getDeclaredMethod(methodName, parameterTypes);

        assertEquals(ADMIN_OR_EMPLOYEE, method.getAnnotation(PreAuthorize.class).value());
    }

    @Test
    void genreSyncRemainsAdminOnly() throws NoSuchMethodException {
        Method method = TmdbController.class.getDeclaredMethod("syncGenres");

        assertEquals("hasRole('ADMIN')", method.getAnnotation(PreAuthorize.class).value());
    }
}
