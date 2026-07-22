package movieservice.dto.response;

import java.time.LocalDate;

public record AutoShowtimeGenerationAcceptedResponse(
        Long generationRunId,
        String status,
        LocalDate startDate,
        LocalDate endDate
) {
}
