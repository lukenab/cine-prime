package movieservice.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateMovieAvailabilityRequest {

    @NotNull(message = "movieId is required")
    Long movieId;

    @NotNull(message = "clusterId is required")
    Long clusterId;

    LocalDateTime salesStartAt;

    @NotNull(message = "showingStartDate is required")
    LocalDate showingStartDate;

    LocalDate showingEndDate;
}
