package bookingservice.dto.request;

import java.math.BigDecimal;

/** Contract ma Booking Service gui sang Promotion Service tu server-side snapshot. */
public record PromotionQuoteRequest(
        String promotionCode,
        String bookingId,
        String accountId,
        Long movieId,
        Long showtimeId,
        Long branchId,
        BigDecimal subtotalAmount,
        String currency) {
}
