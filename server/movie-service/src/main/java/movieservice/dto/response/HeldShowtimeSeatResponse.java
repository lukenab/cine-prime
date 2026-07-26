package movieservice.dto.response;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HeldShowtimeSeatResponse {
    private Long seatId;
    private String seatCode;
    private String seatType;
    private BigDecimal price;
}
