package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class AutoShowtimeRunAcceptedListener {

    private final AutoShowtimeRunDispatcher runDispatcher;

    /** Dispatch only after the durable ACCEPTED row has committed. */
    @Async("autoShowtimeTaskExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRunAccepted(AutoShowtimeRunAcceptedEvent event) {
        runDispatcher.dispatch(event.generationRunId());
    }
}
