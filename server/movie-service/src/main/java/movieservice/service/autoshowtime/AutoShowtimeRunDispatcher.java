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

    /** Execute one accepted run without letting a failure strand it indefinitely. */
    public void dispatch(Long generationRunId) {
        try {
            runExecutor.execute(generationRunId);
        } catch (RuntimeException exception) {
            log.error("Auto showtime generation run {} failed", generationRunId, exception);
            runFailureService.markFailed(generationRunId, exception);
        }
    }
}
