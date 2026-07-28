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
    private List<Long> seatIds;
    private List<HeldShowtimeSeatResponse> seats;
    private BigDecimal totalPrice;
    private LocalDateTime expiresAt;
    private boolean replayed;
}
