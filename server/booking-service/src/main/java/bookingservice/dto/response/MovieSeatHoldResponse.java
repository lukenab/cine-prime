package bookingservice.dto.response;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import lombok.Data;

@Data
public class MovieSeatHoldResponse {
    private String holdId;
    private Long showtimeId;
    private List<Long> seatIds;
    private List<HeldShowtimeSeatResponse> seats;
    private BigDecimal totalPrice;
    private OffsetDateTime expiresAt;
    private boolean replayed;
}
