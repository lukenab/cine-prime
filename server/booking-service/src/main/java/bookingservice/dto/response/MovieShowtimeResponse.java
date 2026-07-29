package bookingservice.dto.response;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class MovieShowtimeResponse {
    private Long showTimeId;
    private LocalDate showDate;
    private LocalTime startTime;
    private Long movieId;
    private String movieName;
    private Long cinemaRoomId;
    private String cinemaRoomName;
    private Long clusterId;
    private String clusterName;
    private String status;
    private String formatCode;
    private BigDecimal price;
}
