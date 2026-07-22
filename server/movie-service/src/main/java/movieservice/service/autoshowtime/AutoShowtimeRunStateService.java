package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.GenerationRunStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.ShowtimeGenerationRunRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

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

    private ShowtimeGenerationRun lock(Long runId) {
        return runRepository.findByGenerationRunIdForUpdate(runId)
                .orElseThrow(() -> new AppException(MovieErrorCode.GENERATION_RUN_NOT_FOUND));
    }
}
