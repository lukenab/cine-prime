package movieservice.service.autoshowtime.optimizer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.OptimizerMode;
import movieservice.enums.SolverStatus;
import movieservice.service.autoshowtime.ShowtimeCandidate;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * The only class in the codebase that knows about {@link OptimizerMode}. AutoShowtimeRunExecutor
 * calls this instead of choosing between LegacyGreedyScheduleOptimizer/CpSatScheduleOptimizer
 * itself, so adding a third mode later never touches the executor.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleOptimizerResolver {

    private final LegacyGreedyScheduleOptimizer legacyOptimizer;
    private final CpSatScheduleOptimizer cpSatOptimizer;

    public ScheduleOptimizationResult resolveAndOptimize(ShowtimeGenerationRun run, List<ShowtimeCandidate> rawCandidates) {
        OptimizerMode mode = run.getOptimizerMode() == null ? OptimizerMode.LEGACY : run.getOptimizerMode();

        return switch (mode) {
            case LEGACY -> legacyOptimizer.optimize(run, rawCandidates);
            case CP_SAT -> runCpSatWithFallback(run, rawCandidates);
            case SHADOW_COMPARE -> runShadowCompare(run, rawCandidates);
        };
    }

    /// CP_SAT mode: legacy is the fallback whenever the policy allows it and CP-SAT either
    /// throws (native solver error, model construction bug) or returns a status that must not
    /// be treated as a usable schedule (INFEASIBLE/MODEL_INVALID/UNKNOWN). Falling back silently
    /// changes *how* the schedule was produced, so the returned diagnostics still report the
    /// original CP-SAT status - callers that persist this run must record that a fallback
    /// happened (AutoShowtimeRunExecutor logs it; see also ShowtimeGenerationRun.solverStatus).
    ///
    /// Catches RuntimeException | Error (not just RuntimeException): a missing/incompatible
    /// OR-Tools native library surfaces as UnsatisfiedLinkError/NoClassDefFoundError, both
    /// Error subclasses. Those used to fall straight through this method uncaught, past
    /// AutoShowtimeRunExecutor's own RuntimeException-only catch, and out of the @Async worker
    /// thread entirely - Spring logs the async exception but never calls runStateService.fail(),
    /// so the run's row stays RUNNING forever with no worker actually alive. The 5-minute orphan
    /// sweep in AutoShowtimeGenerationScheduler then reports it as "no active worker" - which is
    /// accurate for the *sweep*, but the real bug is upstream: this catch is what should have
    /// converted the native failure into an immediate legacy fallback or a fast FAILED status.
    private ScheduleOptimizationResult runCpSatWithFallback(ShowtimeGenerationRun run, List<ShowtimeCandidate> rawCandidates) {
        boolean fallbackAllowed = run.getPolicy().getOptimizerFallbackToLegacyOnError() == null
                || run.getPolicy().getOptimizerFallbackToLegacyOnError();

        ScheduleOptimizationResult cpSatResult;
        try {
            cpSatResult = cpSatOptimizer.optimize(run, rawCandidates);
        } catch (RuntimeException | Error exception) {
            log.warn("CP-SAT optimizer threw for generation run {}; {}", run.getGenerationRunId(),
                    fallbackAllowed ? "falling back to legacy." : "fallback disabled, propagating.", exception);
            if (!fallbackAllowed) {
                throw exception;
            }
            return legacyOptimizer.optimize(run, rawCandidates);
        }

        boolean usableStatus = cpSatResult.solverStatus() == SolverStatus.OPTIMAL
                || cpSatResult.solverStatus() == SolverStatus.FEASIBLE;
        if (usableStatus || !fallbackAllowed) {
            return cpSatResult;
        }

        log.warn("CP-SAT returned {} for generation run {}; falling back to legacy.",
                cpSatResult.solverStatus(), run.getGenerationRunId());
        return legacyOptimizer.optimize(run, rawCandidates);
    }

    /// SHADOW_COMPARE: both algorithms run against the same immutable candidate input; only the
    /// legacy result is ever persisted/published (kept as the safe default primary), CP-SAT's
    /// result is folded into the returned diagnostics for comparison and never written to
    /// customer-facing state.
    ///
    /// Same RuntimeException | Error widening as runCpSatWithFallback, for the same reason: a
    /// native solver crash here must not escape as an uncaught Error and strand the run.
    private ScheduleOptimizationResult runShadowCompare(ShowtimeGenerationRun run, List<ShowtimeCandidate> rawCandidates) {
        ScheduleOptimizationResult legacyResult = legacyOptimizer.optimize(run, rawCandidates);

        ScheduleOptimizationResult cpSatResult;
        try {
            cpSatResult = cpSatOptimizer.optimize(run, rawCandidates);
        } catch (RuntimeException | Error exception) {
            log.warn("CP-SAT optimizer threw during shadow comparison for generation run {}; "
                    + "reporting legacy-only.", run.getGenerationRunId(), exception);
            return legacyResult;
        }

        return new ScheduleOptimizationResult(
                legacyResult.selection(), legacyResult.solverStatus(), legacyResult.objectiveBreakdown(),
                legacyResult.diagnostics(), cpSatResult);
    }
}
