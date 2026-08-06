package promotionservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;
import jakarta.validation.constraints.NotNull;
import promotionservice.enums.PromotionBenefitScope;

public record PromotionUpsertRequest(@NotBlank @Size(max = 64) String code,
                                     @NotBlank @Size(max = 160) String name,
                                     String description, @NotNull PromotionBenefitScope benefitScope,
                                     OffsetDateTime validFrom, OffsetDateTime validUntil,
                                     Integer globalUsageLimit, Integer perAccountUsageLimit,
                                     @Valid PromotionPriceRuleRequest priceRule,
                                     List<@Valid PromotionTargetRequest> targets) {}
