package movieservice.enums;

/**
 * Maps to objective-weight adjustments in CpSatObjectiveBuilder - never duplicate solver code
 * per scenario, only vary the weights/targets fed into the same model.
 */
public enum OptimizationScenario {
    /** High schedule stability, lower room-share concentration, higher occupancy threshold. */
    CONSERVATIVE,
    /** Balanced utilization, demand satisfaction, diversity and stability. */
    BALANCED,
    /** Prioritizes expected occupied seats/revenue and prime-time/premium-room allocation. */
    REVENUE_FOCUSED
}
