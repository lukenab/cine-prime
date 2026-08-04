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

    /**
     * Set only when the customer entered a code but it could not be reserved (invalid, quota
     * exhausted, or promotion-service unavailable). The booking still succeeds without the
     * discount - a bad code must not cost the customer their seat hold.
     */
    String promotionRejectionReason;
}
