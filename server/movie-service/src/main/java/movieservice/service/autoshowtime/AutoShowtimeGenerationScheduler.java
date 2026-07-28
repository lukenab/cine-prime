package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.GenerationRunStatus;
import movieservice.repository.ShowtimeGenerationRunRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class AutoShowtimeGenerationScheduler {

    private final ShowtimeGenerationRunRepository generationRunRepository;
    private final AutoShowtimeRunDispatcher runDispatcher;
    private final AutoShowtimeRunStateService runStateService;

    @Value("${auto-showtime.scheduler.stale-running-threshold-minutes:5}")
    private int staleRunningThresholdMinutes;

    /**
     * Recovery poller for durable ACCEPTED runs. Normal runs are dispatched
     * immediately after their submit transaction commits.
     */
    @Scheduled(fixedDelayString = "${auto-showtime.scheduler.fixed-delay-ms:60000}")
    public void executeAcceptedRuns() {
        generationRunRepository.findTop20ByStatusOrderByCreatedAtAsc(GenerationRunStatus.ACCEPTED)
                .forEach(run -> runDispatcher.dispatch(run.getGenerationRunId()));
    }

    /**
     * Reclaims runs stuck in RUNNING whose worker never called finish()/fail() - normally caused
     * by the process restarting mid-execution (a dev-server hot-reload, a deploy, a crash).
     * Unlike ACCEPTED, a RUNNING row has no other recovery path: the design assumes RUNNING means
     * "a worker currently owns this," which becomes false the moment that worker dies without
     * updating the row. CP-SAT runs widen this window versus the near-instant legacy algorithm
     * (up to policy.maxSolveTimeSeconds), so this sweep matters more now than before P1.
     */
    @Scheduled(fixedDelayString = "${auto-showtime.scheduler.fixed-delay-ms:60000}")
    public void reclaimStaleRunningRuns() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(staleRunningThresholdMinutes);
        for (ShowtimeGenerationRun run : generationRunRepository
                .findTop20ByStatusAndStartedAtBeforeOrderByStartedAtAsc(GenerationRunStatus.RUNNING, cutoff)) {
            boolean reclaimed = runStateService.reclaimIfStillRunning(run.getGenerationRunId(),
                    "Run was orphaned: RUNNING for longer than " + staleRunningThresholdMinutes
                            + " minutes with no active worker (likely an interrupted restart or crash). "
                            + "Marked FAILED automatically so it can be retried.");
            if (reclaimed) {
                log.warn("Reclaimed orphaned generation run {} (RUNNING since before {})",
                        run.getGenerationRunId(), cutoff);
            }
        }
    }
}
