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
            Long publishedShowtimeId
    ) {
    }
}

