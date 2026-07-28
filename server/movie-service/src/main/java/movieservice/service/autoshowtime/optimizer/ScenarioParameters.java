package movieservice.service.autoshowtime.optimizer;

import movieservice.enums.OptimizationScenario;

/**
 * Maps a scenario to numeric parameters threaded through the *same* CP-SAT model/constraint/
 * objective code - scenarios must never duplicate solver logic (P1 §13), only vary these inputs.
 *
 * @param roomShareMultiplier    scales policy.maximumRoomShare before computing the concurrent-room cap
 * @param softTargetMultiplier   how far above the hard weekly minimum the soft coverage target reaches
 * @param shortfallPenaltyWeight objective weight applied per unit of unmet soft coverage target
 */
public record ScenarioParameters(double roomShareMultiplier, double softTargetMultiplier, double shortfallPenaltyWeight) {

    public static ScenarioParameters forScenario(OptimizationScenario scenario) {
        return switch (scenario) {
            // Fewer risky additional sessions, lower room-share concentration, high stability.
            case CONSERVATIVE -> new ScenarioParameters(0.8, 1.1, 0.15);
            // Balanced utilization, demand satisfaction and diversity - the closest match to
            // legacy's own default behavior.
            case BALANCED -> new ScenarioParameters(1.0, 1.3, 0.25);
            // Prioritizes expected occupied seats/revenue over broad coverage; allows more
            // concentrated room-share for premium/high-demand titles.
            case REVENUE_FOCUSED -> new ScenarioParameters(1.15, 1.6, 0.10);
        };
    }
}
