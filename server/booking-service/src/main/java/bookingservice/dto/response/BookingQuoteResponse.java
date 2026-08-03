package bookingservice.dto.response;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record BookingQuoteResponse(
        String quoteId,
        List<BookingItemResponse> lineItems,
        BigDecimal subTotal,
        BigDecimal discountAmount,
        BigDecimal finalAmount,
        OffsetDateTime expiresAt) {
}
