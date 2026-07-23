package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.enums.GenerationRunStatus;
import movieservice.repository.ShowtimeGenerationRunRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AutoShowtimeGenerationScheduler {

    private final ShowtimeGenerationRunRepository generationRunRepository;
    private final AutoShowtimeRunDispatcher runDispatcher;

    /**
     * Recovery poller for durable ACCEPTED runs. Normal runs are dispatched
     * immediately after their submit transaction commits.
     */
    @Scheduled(fixedDelayString = "${auto-showtime.scheduler.fixed-delay-ms:60000}")
    public void executeAcceptedRuns() {
        generationRunRepository.findTop20ByStatusOrderByCreatedAtAsc(GenerationRunStatus.ACCEPTED)
                .forEach(run -> runDispatcher.dispatch(run.getGenerationRunId()));
    }
}
