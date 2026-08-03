package movieservice.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShowtimeSeatHoldResponse {
    private String holdId;
    private Long showtimeId;
    /**
     * Context duoc lay tu Showtime o Movie Service. Booking Service phai dung
     * gia tri nay khi goi Promotion Service, khong nhan movieId tu client.
     */
    private Long movieId;
    /** Cinema cluster cua phong chieu, de ho tro promotion theo cum rap. */
    private Long clusterId;
    private List<Long> seatIds;
    private List<HeldShowtimeSeatResponse> seats;
    private BigDecimal totalPrice;
    private LocalDateTime expiresAt;
    private boolean replayed;
}
