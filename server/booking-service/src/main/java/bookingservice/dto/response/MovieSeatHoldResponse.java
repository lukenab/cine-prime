package bookingservice.dto.response;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import lombok.Data;

@Data
public class MovieSeatHoldResponse {
    private String holdId;
    private Long showtimeId;
    /** Context authoritative do Movie Service tra ve cung seat hold. */
    private Long movieId;
    private Long clusterId;
    private List<Long> seatIds;
    private List<HeldShowtimeSeatResponse> seats;
    private BigDecimal totalPrice;
    private OffsetDateTime expiresAt;
    private boolean replayed;
}
