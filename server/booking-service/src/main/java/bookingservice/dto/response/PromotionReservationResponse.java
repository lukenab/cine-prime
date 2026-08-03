package bookingservice.dto.response;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PromotionReservationResponse(
        UUID reservationId,
        UUID promotionId,
        String bookingId,
        String accountId,
        String status,
        BigDecimal subtotalAmount,
        BigDecimal discountAmount,
        BigDecimal finalAmount,
        String currency,
        OffsetDateTime expiresAt) {
}
