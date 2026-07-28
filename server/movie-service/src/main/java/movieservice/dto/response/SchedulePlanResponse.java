package movieservice.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;

public record SchedulePlanResponse(
        Long schedulePlanId,
        Long generationRunId,
        String status,
        Integer blockerCount,
        String validationSummary,
        LocalDateTime validatedAt,
        String validatedBy,
        List<Slot> slots,
        LocalDateTime submittedAt,
        String submittedBy,
        LocalDateTime publishedAt,
        String publishedBy,
        String reviewNote
) {
    public record Slot(
            Long schedulePlanSlotId,
            Long movieId,
            String movieTitle,
            String moviePosterUrl,
            Long clusterId,
            String clusterName,
            Long cinemaRoomId,
            String cinemaRoomName,
            Long screeningVersionId,
            String formatCode,
            String audioLanguageCode,
            String subtitleLanguageCode,
            LocalDate businessDate,
            OffsetDateTime startAt,
            OffsetDateTime endAt,
            BigDecimal basePrice,
            Integer totalSeats,
            String generationReason,
            ScoreBreakdown scoreBreakdown,
            Long publishedShowtimeId
    ) {
    }

    public record ScoreBreakdown(
            BigDecimal allocationScore,
            String daypart,
            BigDecimal movieDemandScore,
            BigDecimal clusterDemandScore,
            BigDecimal timeDemandScore,
            BigDecimal formatDemandScore,
            BigDecimal capacityFitScore,
            Integer expectedAttendance,
            Integer roomCapacity
    ) {
    }
}
