package movieservice.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@RequiredArgsConstructor
public class LifecycleEventNotifier {

    private final ApplicationEventPublisher eventPublisher;

    public void notifyChange(
            String aggregateType,
            Long aggregateId,
            String status,
            String action,
            Long movieId,
            Long clusterId) {
        eventPublisher.publishEvent(new LifecycleChangeEvent(
                aggregateType,
                aggregateId,
                status,
                action,
                movieId,
                clusterId,
                Instant.now()));
    }
}
