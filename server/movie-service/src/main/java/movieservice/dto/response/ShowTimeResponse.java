package movieservice.dto.response;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
public class ShowTimeResponse {

    private Long showTimeId;

    private LocalDate showDate;

    private LocalTime startTime;

    private LocalTime endTime;

    private LocalDateTime updateAt;
}