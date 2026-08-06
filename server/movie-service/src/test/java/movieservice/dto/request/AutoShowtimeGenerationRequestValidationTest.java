package movieservice.dto.request;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AutoShowtimeGenerationRequestValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsScopesThatExceedTheDemoSafeLimits() {
        AutoShowtimeGenerationRequest request = new AutoShowtimeGenerationRequest(
                LocalDate.now().plusDays(3),
                LocalDate.now().plusDays(5),
                List.of(1L, 2L, 3L, 4L),
                List.of(11L, 12L, 13L, 14L, 15L, 16L),
                null, null, false, List.of(), List.of()
        );

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactlyInAnyOrder("cinemaClusterIds", "movieIds");
    }
}
