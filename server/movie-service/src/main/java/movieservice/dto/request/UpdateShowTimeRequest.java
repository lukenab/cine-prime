package movieservice.dto.request;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * All fields are optional — only non-null fields are applied during update.
 */
@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UpdateShowTimeRequest {

    Long movieId;

    Long cinemaRoomId;

    LocalDate showDate;

    LocalTime startTime;
}
