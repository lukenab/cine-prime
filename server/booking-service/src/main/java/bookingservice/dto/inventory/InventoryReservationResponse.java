package bookingservice.dto.inventory;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryReservationResponse {
    private String holdToken;
    private String status;
    private OffsetDateTime expiresAt;
    private ShowtimeSnapshot showtime;
    private List<SeatSnapshot> seats;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShowtimeSnapshot {
        private Long showtimeId;
        private Long movieId;
        private String movieName;
        private Long clusterId;
        private String clusterName;
        private Long cinemaRoomId;
        private String cinemaRoomName;
        private LocalDate showDate;
        private LocalTime startTime;
        private String timezone;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SeatSnapshot {
        private Long showtimeSeatId;
        private String seatCode;
        private String seatType;
        private BigDecimal price;
    }
}
