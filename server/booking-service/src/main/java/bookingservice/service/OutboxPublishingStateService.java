package bookingservice.service;

import bookingservice.entity.OutboxEvent;
import bookingservice.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OutboxPublishingStateService {
    private static final List<String> RETRYABLE_STATUSES = List.of("PENDING", "FAILED");
    private static final int MAX_ATTEMPTS = 12;

    private final OutboxEventRepository outboxEventRepository;
    private final Clock bookingClock;

    @Transactional(readOnly = true)
    public List<String> dueEventIds() {
        return outboxEventRepository
                .findDue(
                        RETRYABLE_STATUSES,
                        OffsetDateTime.now(bookingClock))
                .stream()
                .map(OutboxEvent::getEventId)
                .toList();
    }

    @Transactional
    public PublishInstruction claim(String eventId) {
        OutboxEvent event = outboxEventRepository.findByIdForUpdate(eventId).orElse(null);
        if (event == null || "PUBLISHED".equals(event.getStatus())
                || "PROCESSING".equals(event.getStatus())) {
            return null;
        }
        OffsetDateTime now = OffsetDateTime.now(bookingClock);
        if (event.getNextAttemptAt() != null && event.getNextAttemptAt().isAfter(now)) {
            return null;
        }
        event.setStatus("PROCESSING");
        event.setAttemptCount(event.getAttemptCount() + 1);
        event.setLastError(null);
        return new PublishInstruction(
                event.getEventId(),
                event.getPartitionKey(),
                event.getEventType(),
                event.getSchemaVersion(),
                event.getOccurredAt(),
                event.getCorrelationId(),
                event.getCausationId(),
                event.getPayload());
    }

    @Transactional
    public void markPublished(String eventId) {
        outboxEventRepository.findByIdForUpdate(eventId).ifPresent(event -> {
            if ("PUBLISHED".equals(event.getStatus())) {
                return;
            }
            event.setStatus("PUBLISHED");
            event.setPublishedAt(OffsetDateTime.now(bookingClock));
            event.setNextAttemptAt(null);
            event.setLastError(null);
        });
    }

    @Transactional
    public void markFailed(String eventId, Throwable exception) {
        outboxEventRepository.findByIdForUpdate(eventId).ifPresent(event -> {
            boolean exhausted = event.getAttemptCount() >= MAX_ATTEMPTS;
            event.setStatus(exhausted ? "DEAD" : "FAILED");
            event.setNextAttemptAt(exhausted
                    ? null
                    : OffsetDateTime.now(bookingClock).plusSeconds(backoffSeconds(event.getAttemptCount())));
            event.setLastError(safeMessage(exception));
        });
    }

    private long backoffSeconds(int attempt) {
        return Math.min(900L, 5L * (1L << Math.min(attempt, 7)));
    }

    private String safeMessage(Throwable exception) {
        String message = exception.getMessage();
        String result = exception.getClass().getSimpleName()
                + (message == null ? "" : ": " + message);
        return result.length() > 2000 ? result.substring(0, 2000) : result;
    }

    public record PublishInstruction(
            String eventId,
            String partitionKey,
            String eventType,
            String eventVersion,
            OffsetDateTime occurredAt,
            String correlationId,
            String causationId,
            String payload) {
    }
}
