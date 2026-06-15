package movieservice.dto.request;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class ShowTimeRequest {

    @NotNull(message = "Show date cannot be blank")
    private LocalDate showDate;

    @NotNull(message = "Start time cannot be blank")
    private LocalTime startTime;

    private LocalTime endTime;

    @NotNull(message = "Cinema room ID cannot be blank")
    private Long cinemaRoomId;
}