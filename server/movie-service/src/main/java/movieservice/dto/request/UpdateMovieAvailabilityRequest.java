package movieservice.dto.request;

import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Partial update — only PLANNED windows may be edited (validated in service). */
@Getter
public class UpdateMovieAvailabilityRequest {

    LocalDateTime salesStartAt;
    LocalDate showingStartDate;
    LocalDate showingEndDate;
}
