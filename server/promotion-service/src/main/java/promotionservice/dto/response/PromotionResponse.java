package promotionservice.dto.response;

import promotionservice.enums.DiscountType;
import promotionservice.enums.PromotionStatus;
import promotionservice.enums.PromotionTargetType;
import promotionservice.enums.PromotionBenefitScope;
import promotionservice.enums.PromotionAvailabilityStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PromotionResponse(UUID promotionId, String code, String name, String description,
                                PromotionStatus status, PromotionAvailabilityStatus availabilityStatus,
                                PromotionBenefitScope benefitScope,
                                OffsetDateTime validFrom, OffsetDateTime validUntil,
                                Integer globalUsageLimit, Integer perAccountUsageLimit, Long version,
                                OffsetDateTime createdAt, OffsetDateTime updatedAt,
                                int activeReservationCount, int committedUsageCount,
                                Workflow workflow,
                                PriceRule priceRule, List<Target> targets, List<AuditEntry> auditLog) {
    public record Workflow(String createdByAccountId,
                           String submittedByAccountId, OffsetDateTime submittedAt,
                           String approvedByAccountId, OffsetDateTime approvedAt) {}
    public record PriceRule(DiscountType discountType, BigDecimal percentage, BigDecimal fixedAmount,
                            BigDecimal maxDiscountAmount, BigDecimal minimumOrderAmount, String currency) {}
    public record Target(PromotionTargetType targetType, Long movieId, Long showtimeId) {}
    public record AuditEntry(UUID auditLogId, String action, String actorAccountId, OffsetDateTime occurredAt,
                             java.util.Map<String, Object> detail) {}
}
