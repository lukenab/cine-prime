package bookingservice.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Value
@Builder
public class CreateBookingResponse {
    String bookingId;
    String bookingCode;
    String status;
    String holdId;
    String holdToken;
    OffsetDateTime lockedUntil;
    BigDecimal subtotal;
    BigDecimal serviceFee;
    BigDecimal discount;
    BigDecimal total;
    String currency;
    List<BookingItemResponse> seats;
    
    // Promotion fields from HEAD
    String promotionCode;
    BigDecimal promotionDiscountAmount;
}
