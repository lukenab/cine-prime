package movieservice.dto.response;

import movieservice.enums.SchedulePlanStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record SchedulePlanSummaryResponse(
        Long schedulePlanId,
        Long generationRunId,
        SchedulePlanStatus status,
        Integer blockerCount,
        LocalDate startDate,
        LocalDate endDate,
        String requestedBy,
        Long sessionCount,
        Long roomCount,
        Long cinemaCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime submittedAt,
        LocalDateTime approvedAt,
        LocalDateTime publishedAt
) {
}
