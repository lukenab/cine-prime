package promotionservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

/**
 * Snapshot do Booking Service tính từ server-side seat price, không nhận trực tiếp từ UI.
 */
public record PromotionQuoteRequest(@NotBlank String promotionCode, @NotBlank String bookingId,
                                    @NotBlank String accountId, Long movieId, Long showtimeId, Long branchId,
                                    @NotNull @PositiveOrZero BigDecimal ticketSubtotal,
                                    @NotNull @PositiveOrZero BigDecimal concessionSubtotal,
                                    @NotNull @PositiveOrZero BigDecimal serviceFee,
                                    String currency) {
}
