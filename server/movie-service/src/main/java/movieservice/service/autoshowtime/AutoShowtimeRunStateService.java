package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.GenerationRunStatus;
import movieservice.enums.SolverStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.ShowtimeGenerationRunRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AutoShowtimeRunStateService {
    private final ShowtimeGenerationRunRepository runRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean claim(Long runId) {
        ShowtimeGenerationRun run = lock(runId);
        if (run.getStatus() == GenerationRunStatus.RUNNING
                || run.getStatus() == GenerationRunStatus.COMPLETED) return false;
        run.setStatus(GenerationRunStatus.RUNNING);
        if (run.getStartedAt() == null) run.setStartedAt(LocalDateTime.now());
        run.setCompletedAt(null);
        return true;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ShowtimeGenerationRun finish(Long runId, int candidateCount, int createdCount, int skippedCount,
                                        int succeededPartitions, int failedPartitions, String failureDetail) {
        ShowtimeGenerationRun run = lock(runId);
        run.setCandidateCount(candidateCount);
        run.setCreatedCount(createdCount);
        run.setSkippedCount(skippedCount);
        run.setSuccessfulPartitionCount(succeededPartitions);
        run.setFailedPartitionCount(failedPartitions);
        run.setFailureDetail(failureDetail);
        run.setCompletedAt(LocalDateTime.now());
        if (failedPartitions == 0) run.setStatus(GenerationRunStatus.COMPLETED);
        else if (succeededPartitions > 0) run.setStatus(GenerationRunStatus.PARTIALLY_COMPLETED);
        else run.setStatus(GenerationRunStatus.FAILED);
        return run;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ShowtimeGenerationRun fail(Long runId, String detail) {
        return finish(runId, 0, 0, 0, 0, 1, detail);
    }

    /// Reclaims a run whose worker died mid-flight (e.g. a dev-server restart during a CP-SAT
    /// solve) without ever calling finish()/fail(). Re-checks status under the same pessimistic
    /// lock claim()/finish() use, so a genuinely still-active worker's row is never clobbered -
    /// if the worker finished between the scheduler's SELECT and this call, the row is no longer
    /// RUNNING and this is a safe no-op.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean reclaimIfStillRunning(Long runId, String detail) {
        ShowtimeGenerationRun run = lock(runId);
        if (run.getStatus() != GenerationRunStatus.RUNNING) {
            return false;
        }
        run.setFailureDetail(detail);
        run.setCompletedAt(LocalDateTime.now());
        run.setFailedPartitionCount(Math.max(1, run.getFailedPartitionCount() == null ? 1 : run.getFailedPartitionCount()));
        run.setStatus(GenerationRunStatus.FAILED);
        return true;
    }

    /// Separate from finish() so adding optimizer diagnostics never touches the pre-existing
    /// finish()/fail() signatures other callers and tests already depend on.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordOptimizerOutcome(Long runId, SolverStatus solverStatus, Long solveDurationMillis,
            BigDecimal objectiveScore, String objectiveBreakdownJson, String solverDiagnosticsJson,
            String shadowComparisonJson) {
        ShowtimeGenerationRun run = lock(runId);
        run.setSolverStatus(solverStatus);
        run.setSolveDurationMillis(solveDurationMillis);
        run.setObjectiveScore(objectiveScore);
        run.setObjectiveBreakdown(objectiveBreakdownJson);
        run.setSolverDiagnostics(solverDiagnosticsJson);
        run.setShadowComparison(shadowComparisonJson);
    }

    private ShowtimeGenerationRun lock(Long runId) {
        return runRepository.findByGenerationRunIdForUpdate(runId)
                .orElseThrow(() -> new AppException(MovieErrorCode.GENERATION_RUN_NOT_FOUND));
    }
}
