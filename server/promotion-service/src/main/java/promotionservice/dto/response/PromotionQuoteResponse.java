package promotionservice.dto.response;

import java.math.BigDecimal;
import java.util.UUID;
import promotionservice.enums.PromotionBenefitScope;

public record PromotionQuoteResponse(boolean eligible, String reasonCode, UUID promotionId,
                                     PromotionBenefitScope benefitScope,
                                     BigDecimal subtotalAmount, BigDecimal discountAmount,
                                     BigDecimal finalAmount, String currency) {}
