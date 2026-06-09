package movieservice.dto;

import java.time.LocalDate;
import java.time.LocalTime;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ShowTimeDTO {
    private Long showTimeId;

    private Long roomId;
    private Integer movieId;
    private LocalDate showDate;

    private LocalTime startTime;

    private LocalTime endTime;
}
