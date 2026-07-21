package movieservice.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** "Wide release" — create a PLANNED window for many clusters in one call, instead of
 *  one CreateMovieAvailabilityRequest per cluster. Either allActiveClusters=true (every
 *  currently ACTIVE cluster) or an explicit clusterIds list; allActiveClusters wins if both
 *  are set. */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BulkCreateMovieAvailabilityRequest {

    @NotNull(message = "movieId is required")
    Long movieId;

    List<Long> clusterIds;

    Boolean allActiveClusters;

    @NotNull(message = "showingStartDate is required")
    LocalDate showingStartDate;

    LocalDate showingEndDate;

    LocalDateTime salesStartAt;
}
