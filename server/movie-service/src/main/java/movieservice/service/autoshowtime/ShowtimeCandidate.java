package movieservice.service.autoshowtime;

import lombok.Builder;
import lombok.Getter;
import movieservice.enums.GenerationReason;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Builder(toBuilder = true)
public class ShowtimeCandidate {
    Long generationRunId;

    Long movieId;
    Long clusterId;
    Long cinemaRoomId;
    Integer formatId;

    LocalDate showDate;
    LocalTime startTime;
    LocalTime endTime;

    BigDecimal score;

    GenerationReason generationReason;
}
