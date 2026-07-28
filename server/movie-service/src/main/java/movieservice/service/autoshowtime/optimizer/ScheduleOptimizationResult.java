package movieservice.service.autoshowtime.optimizer;

import movieservice.enums.SolverStatus;
import movieservice.service.autoshowtime.AutoShowtimeSelectionResult;

/**
 * What every {@link ScheduleOptimizer} returns, regardless of whether it's the legacy greedy
 * algorithm or CP-SAT. Wraps the existing {@link AutoShowtimeSelectionResult} (selected/rejected
 * candidates - unchanged, so AutoShowtimeRunExecutor's persistence path doesn't need to know
 * which optimizer produced it) plus the solver-status/objective/diagnostics fields P1 requires
 * to be exposed through the API.
 */
public record ScheduleOptimizationResult(
        AutoShowtimeSelectionResult selection,
        SolverStatus solverStatus,
        ObjectiveBreakdown objectiveBreakdown,
        SolverDiagnostics diagnostics,
        /** Only non-null in SHADOW_COMPARE mode - the non-primary optimizer's own result. */
        ScheduleOptimizationResult shadowComparison
) {
    public ScheduleOptimizationResult(AutoShowtimeSelectionResult selection, SolverStatus solverStatus,
            ObjectiveBreakdown objectiveBreakdown, SolverDiagnostics diagnostics) {
        this(selection, solverStatus, objectiveBreakdown, diagnostics, null);
    }
}
