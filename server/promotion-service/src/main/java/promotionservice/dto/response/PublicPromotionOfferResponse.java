package promotionservice.dto.response;

import promotionservice.enums.DiscountType;
import promotionservice.enums.PromotionBenefitScope;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Customer-safe projection for the public offers catalogue. */
public record PublicPromotionOfferResponse(
        UUID promotionId,
        String code,
        String name,
        String description,
        PromotionBenefitScope benefitScope,
        OffsetDateTime validFrom,
        OffsetDateTime validUntil,
        DiscountType discountType,
        BigDecimal percentage,
        BigDecimal fixedAmount,
        BigDecimal maxDiscountAmount,
        BigDecimal minimumOrderAmount,
        String currency
) {
}
