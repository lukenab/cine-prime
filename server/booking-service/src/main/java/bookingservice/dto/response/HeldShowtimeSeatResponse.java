package bookingservice.dto.response;

import java.math.BigDecimal;

import lombok.Data;

@Data
public class HeldShowtimeSeatResponse {
    private Long seatId;
    private String seatCode;
    private String seatType;
    private BigDecimal price;
}
