package promotionservice.dto.request;

import jakarta.validation.constraints.NotNull;
import promotionservice.enums.DiscountType;
import java.math.BigDecimal;

public record PromotionPriceRuleRequest(@NotNull DiscountType discountType, BigDecimal percentage,
                                        BigDecimal fixedAmount, BigDecimal maxDiscountAmount,
                                        BigDecimal minimumOrderAmount, String currency) {}
