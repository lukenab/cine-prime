package movieservice.lifecycle;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movieservice.websocket.LifecycleWebSocketHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class LifecycleWebSocketPublisher {

    private final ObjectMapper objectMapper;
    private final LifecycleWebSocketHandler webSocketHandler;

    /**
     * Emit only after a successful commit. fallbackExecution covers controller-level events
     * raised after a transactional service call has already returned (for example TMDB import).
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void publish(LifecycleChangeEvent event) {
        try {
            webSocketHandler.broadcast(objectMapper.writeValueAsString(event));
        } catch (JsonProcessingException exception) {
            log.warn("Could not serialize lifecycle event for WebSocket clients", exception);
        }
    }
}
