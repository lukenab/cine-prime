package movieservice.controller;

import movieservice.dto.request.MovieScreeningVersionRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MovieScreeningVersionControllerAuthorizationTest {

    private static final String ADMIN_OR_PROGRAMMING_OPERATOR =
            "hasAnyRole('ADMIN', 'PROGRAMMING_OPERATOR')";

    static Stream<Arguments> versionPreparationEndpoints() {
        return Stream.of(
                Arguments.of("list", new Class<?>[]{Long.class}),
                Arguments.of("create", new Class<?>[]{Long.class, MovieScreeningVersionRequest.class}),
                Arguments.of("createBulk", new Class<?>[]{Long.class, List.class}),
                Arguments.of("update", new Class<?>[]{Long.class, Long.class, MovieScreeningVersionRequest.class}),
                Arguments.of("activate", new Class<?>[]{Long.class, Long.class}),
                Arguments.of("deactivate", new Class<?>[]{Long.class, Long.class})
        );
    }

    @ParameterizedTest
    @MethodSource("versionPreparationEndpoints")
    void versionPreparationIsAvailableToAdminAndProgrammingOperator(
            String methodName,
            Class<?>[] parameterTypes
    ) throws NoSuchMethodException {
        Method method = MovieScreeningVersionController.class.getDeclaredMethod(methodName, parameterTypes);

        assertEquals(ADMIN_OR_PROGRAMMING_OPERATOR, method.getAnnotation(PreAuthorize.class).value());
    }

    @Test
    void authorizationContractCoversEveryControllerCommand() {
        assertEquals(6, versionPreparationEndpoints().count());
    }
}
