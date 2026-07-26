package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class AutoShowtimeRunDispatcher {

    private final AutoShowtimeRunExecutor runExecutor;
    private final AutoShowtimeRunFailureService runFailureService;

    /**
     * Execute one accepted run without letting a failure strand it indefinitely.
     *
     * <p>Catches {@code RuntimeException | Error}, not just {@code RuntimeException}: this is
     * the outermost boundary of the async worker (invoked from the {@code @Async} accepted-run
     * listener and from the recovery poller), so anything that escapes this catch is never
     * reported back to the run row at all - the row stays RUNNING with no path to FAILED except
     * the 5-minute orphan sweep in AutoShowtimeGenerationScheduler, which then logs "no active
     * worker" even though a worker briefly existed and died from an uncaught error (most likely
     * an OR-Tools native-library failure, e.g. UnsatisfiedLinkError/NoClassDefFoundError, both
     * Error subclasses that a RuntimeException-only catch never sees).
     */
    public void dispatch(Long generationRunId) {
        try {
            runExecutor.execute(generationRunId);
        } catch (RuntimeException | Error exception) {
            log.error("Auto showtime generation run {} failed", generationRunId, exception);
            runFailureService.markFailed(generationRunId, exception);
        }
    }
}
