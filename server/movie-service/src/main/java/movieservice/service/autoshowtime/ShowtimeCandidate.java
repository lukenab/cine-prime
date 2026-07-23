package movieservice.service.autoshowtime;

import lombok.Builder;
import lombok.Getter;
import movieservice.enums.GenerationReason;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Getter
@Builder(toBuilder = true)
public class ShowtimeCandidate {
    Long generationRunId;

    Long movieId;
    Long clusterId;
    Long cinemaRoomId;
    Integer formatId;
    Long screeningVersionId;

    LocalDate showDate;
    LocalTime startTime;
    LocalTime endTime;

    OffsetDateTime startAt;
    OffsetDateTime endAt;

    BigDecimal score;

    ShowtimeScoreBreakdown scoreBreakdown;

    GenerationReason generationReason;

    public OffsetDateTime temporalStartAt() {
        return startAt != null
                ? startAt
                : showDate.atTime(startTime).atOffset(ZoneOffset.ofHours(7));
    }

    public OffsetDateTime temporalEndAt() {
        if (endAt != null) {
            return endAt;
        }
        OffsetDateTime resolved = showDate.atTime(endTime).atOffset(ZoneOffset.ofHours(7));
        return resolved.isAfter(temporalStartAt()) ? resolved : resolved.plusDays(1);
    }
}
