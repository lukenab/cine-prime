package movieservice.dto.response;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Represents a single showtime candidate that was skipped due to a conflict.
 */
@Data
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShowTimeConflictDto {

    LocalDate showDate;
    LocalTime startTime;
    LocalTime endTime;
    Long cinemaRoomId;
    String cinemaRoomName;

    /** Human-readable reason why this slot was rejected. */
    String reason;
}
