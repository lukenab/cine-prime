package movieservice.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShowTimeRequest {

    @NotNull(message = "Show date cannot be blank")
    LocalDate showDate;

    @NotNull(message = "Start time cannot be blank")
    LocalTime startTime;

    LocalTime endTime;

    @NotNull(message = "Cinema room ID cannot be blank")
    Long cinemaRoomId;
}