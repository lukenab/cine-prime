package promotionservice.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

public record PromotionQuoteResponse(boolean eligible, String reasonCode, UUID promotionId,
                                     BigDecimal subtotalAmount, BigDecimal discountAmount,
                                     BigDecimal finalAmount, String currency) {}
