package movieservice.dto.response;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShowTimeResponse {

    Long showTimeId;

    LocalDate showDate;

    LocalTime startTime;

    LocalTime endTime;

    LocalDateTime updateAt;
}