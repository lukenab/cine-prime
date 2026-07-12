package movieservice.dto.response;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Represents a single valid showtime candidate (no conflicts detected).
 */
@Data
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShowTimeCandidateDto {

    LocalDate showDate;
    LocalTime startTime;
    LocalTime endTime;
    Long cinemaRoomId;
    String cinemaRoomName;
}
