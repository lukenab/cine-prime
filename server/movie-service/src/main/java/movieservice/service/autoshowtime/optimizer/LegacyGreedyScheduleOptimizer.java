package movieservice.service.autoshowtime.optimizer;

import lombok.RequiredArgsConstructor;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.SolverStatus;
import movieservice.service.autoshowtime.AutoShowtimeCandidateRejection;
import movieservice.service.autoshowtime.AutoShowtimeCandidateScorer;
import movieservice.service.autoshowtime.AutoShowtimeCandidateSelector;
import movieservice.service.autoshowtime.AutoShowtimeSelectionResult;
import movieservice.service.autoshowtime.ShowtimeCandidate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Wraps the pre-existing round-robin-then-fill-by-score algorithm behind {@link ScheduleOptimizer}
 * unchanged, so it remains available as the controlled fallback (OptimizerMode.LEGACY) and as one
 * side of SHADOW_COMPARE. Never proves optimality or infeasibility, so it always reports
 * SolverStatus.FEASIBLE - "feasible" here just means "a valid, constraint-satisfying schedule was
 * produced," which the greedy algorithm always attempts.
 */
@Service
@RequiredArgsConstructor
public class LegacyGreedyScheduleOptimizer implements ScheduleOptimizer {

    private final AutoShowtimeCandidateScorer candidateScorer;
    private final AutoShowtimeCandidateSelector candidateSelector;

    @Override
    public ScheduleOptimizationResult optimize(ShowtimeGenerationRun run, List<ShowtimeCandidate> rawCandidates) {
        long startedAt = System.currentTimeMillis();
        List<ShowtimeCandidate> ranked = candidateScorer.scoreAndRank(run, rawCandidates);
        AutoShowtimeSelectionResult selection = candidateSelector.select(run, ranked);
        long solveDurationMillis = System.currentTimeMillis() - startedAt;

        Map<String, Integer> prunedByReason = new HashMap<>();
        for (AutoShowtimeCandidateRejection rejection : selection.rejectedCandidates()) {
            prunedByReason.merge(rejection.reason().name(), 1, Integer::sum);
        }

        SolverDiagnostics diagnostics = SolverDiagnostics.legacy(
                rawCandidates.size(), rawCandidates.size(), prunedByReason, solveDurationMillis);

        BigDecimal finalScore = selection.selectedCandidates().stream()
                .map(ShowtimeCandidate::getScore)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        ObjectiveBreakdown objectiveBreakdown = ObjectiveBreakdownFactory.fromSelected(
                selection.selectedCandidates(), finalScore, BigDecimal.ZERO, BigDecimal.ZERO);

        return new ScheduleOptimizationResult(selection, SolverStatus.FEASIBLE, objectiveBreakdown, diagnostics);
    }
}
