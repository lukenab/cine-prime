package movieservice.service.autoshowtime.optimizer;

import java.math.BigDecimal;

/**
 * Explains the achieved objective by component, computed by summing each selected candidate's
 * stored {@link movieservice.service.autoshowtime.ShowtimeScoreBreakdown} plus the shortfall
 * penalty CpSatObjectiveBuilder subtracts for under-covered movie/cluster pairs. All components
 * share the same 0..1-normalized scale as the underlying per-candidate scores before weighting,
 * so they can be compared without additional normalization (P1 §4 - "do not combine unrelated
 * metrics without normalization").
 *
 * <p>stabilityPenalty and gapPenalty are reported as 0/informational in P1: stability requires a
 * previous plan revision to compare against, which only exists once rolling replanning (P2) is
 * implemented; gap is computed post-solve as a diagnostic rather than folded into the MILP
 * objective itself (see CpSatObjectiveBuilder javadoc for the reasoning). Both are real fields
 * so P2 can populate them without an API-breaking change.
 */
public record ObjectiveBreakdown(
        BigDecimal demandScore,
        BigDecimal utilizationScore,
        BigDecimal revenueScore,
        BigDecimal primeTimeScore,
        BigDecimal diversityScore,
        BigDecimal stabilityPenalty,
        BigDecimal gapPenalty,
        BigDecimal finalWeightedScore
) {
    public static ObjectiveBreakdown empty() {
        BigDecimal zero = BigDecimal.ZERO;
        return new ObjectiveBreakdown(zero, zero, zero, zero, zero, zero, zero, zero);
    }
}
