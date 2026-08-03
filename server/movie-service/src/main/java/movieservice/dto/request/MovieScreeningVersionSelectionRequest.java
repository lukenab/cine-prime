package movieservice.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Optional per-movie override for automatic scheduling. Movies omitted from the request keep the
 * default AUTO strategy, where every effective ACTIVE screening version can be considered.
 */
public record MovieScreeningVersionSelectionRequest(
        @NotNull Long movieId,
        @NotEmpty List<Long> screeningVersionIds
) {
}
