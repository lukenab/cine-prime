package movieservice.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public record AutoShowtimeGenerationRequest (
    @NotNull
    LocalDate startDate,

    @NotNull
    LocalDate endDate,

    @NotEmpty
    List<Long> cinemaClusterIds,

    @NotEmpty
    List<Long> movieIds
){
}
