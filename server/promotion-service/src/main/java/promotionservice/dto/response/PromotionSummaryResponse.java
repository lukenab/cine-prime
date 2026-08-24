package promotionservice.dto.response;

import promotionservice.enums.DiscountType;
import promotionservice.enums.PromotionBenefitScope;
import promotionservice.enums.PromotionAvailabilityStatus;
import promotionservice.enums.PromotionStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Lightweight representation used by the administration list. */
public record PromotionSummaryResponse(
        UUID promotionId,
        String code,
        String name,
        PromotionStatus status,
        PromotionAvailabilityStatus availabilityStatus,
        PromotionBenefitScope benefitScope,
        OffsetDateTime validFrom,
        OffsetDateTime validUntil,
        int activeReservationCount,
        int committedUsageCount,
        Integer globalUsageLimit,
        PriceRuleSummary priceRule
) {
    public record PriceRuleSummary(
            DiscountType discountType,
            BigDecimal percentage,
            BigDecimal fixedAmount,
            BigDecimal minimumOrderAmount,
            String currency
    ) {}
}
