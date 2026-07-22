package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movieservice.enums.GenerationRunStatus;
import movieservice.repository.ShowtimeGenerationRunRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class AutoShowtimeGenerationScheduler {

    private final ShowtimeGenerationRunRepository generationRunRepository;
    private final AutoShowtimeRunExecutor runExecutor;
    private final AutoShowtimeRunFailureService runFailureService;

    /// Poll các run ACCEPTED theo fixed delay. Default 60 giây, có thể đổi bằng config không cần sửa Java.
    @Scheduled(fixedDelayString = "${auto-showtime.scheduler.fixed-delay-ms:60000}")
    public void executeAcceptedRuns() {
        generationRunRepository.findTop20ByStatusOrderByCreatedAtAsc(GenerationRunStatus.ACCEPTED)
                .forEach(run -> executeSingleRun(run.getGenerationRunId()));
    }

    /// Từng run lỗi được đánh dấu FAILED nhưng không làm scheduler bỏ qua các run khác trong batch.
    private void executeSingleRun(Long generationRunId) {
        try {
            runExecutor.execute(generationRunId);
        } catch (RuntimeException exception) {
            log.error("Auto showtime generation run {} failed", generationRunId, exception);
            runFailureService.markFailed(generationRunId, exception);
        }
    }
}
