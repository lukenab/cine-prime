package promotionservice.enums;

/**
 * Derived customer availability. This is deliberately separate from the
 * persisted approval/lifecycle status of a promotion.
 */
public enum PromotionAvailabilityStatus {
    NOT_AVAILABLE,
    SCHEDULED,
    ACTIVE,
    PAUSED,
    ENDED,
    QUOTA_EXHAUSTED,
    ARCHIVED
}
