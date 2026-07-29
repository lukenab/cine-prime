package bookingservice.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class BookingItemResponse {
    Long showtimeSeatId;
    String seatCode;
    String seatType;
    BigDecimal unitPrice;
    BigDecimal finalPrice;
}
