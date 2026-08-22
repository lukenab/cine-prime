package workforceservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import workforceservice.entity.WorkforceOutboxEvent;
import workforceservice.exception.WorkforceErrorCode;
import workforceservice.repository.WorkforceOutboxRepository;
import java.time.OffsetDateTime;
import java.util.List;

@Service @RequiredArgsConstructor
public class WorkforceOutboxService {
    private static final List<String> RETRYABLE = List.of("PENDING", "FAILED");
    private static final int MAX_ATTEMPTS = 12;
    private final WorkforceOutboxRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void append(String eventId, String aggregateId, long aggregateVersion,
                       String eventType, String eventVersion, String partitionKey, Object payload) {
        try {
            repository.save(WorkforceOutboxEvent.builder()
                    .eventId(eventId).aggregateType("TIMESHEET").aggregateId(aggregateId)
                    .aggregateVersion(aggregateVersion).eventType(eventType).eventVersion(eventVersion)
                    .correlationId(eventId).partitionKey(partitionKey)
                    .payload(objectMapper.writeValueAsString(payload)).publishStatus("PENDING")
                    .attemptCount(0).occurredAt(OffsetDateTime.now()).build());
        } catch (JsonProcessingException exception) {
            throw new AppException(WorkforceErrorCode.EVENT_SERIALIZATION_FAILED);
        }
    }

    @Transactional(readOnly = true)
    public List<String> dueIds() {
        return repository.findDueIds(RETRYABLE, OffsetDateTime.now(), PageRequest.of(0, 100));
    }

    @Transactional
    public PublishInstruction claim(String eventId) {
        WorkforceOutboxEvent event = repository.findByIdForUpdate(eventId).orElse(null);
        if (event == null || "PUBLISHED".equals(event.getPublishStatus()) || "PROCESSING".equals(event.getPublishStatus())) return null;
        OffsetDateTime now = OffsetDateTime.now();
        if (event.getNextAttemptAt() != null && event.getNextAttemptAt().isAfter(now)) return null;
        event.setPublishStatus("PROCESSING");
        event.setAttemptCount(event.getAttemptCount() + 1);
        event.setLastError(null);
        return new PublishInstruction(event.getEventId(), event.getPartitionKey(), event.getEventType(), event.getEventVersion(),
                event.getOccurredAt(), event.getCorrelationId(), event.getCausationId(), event.getPayload());
    }

    @Transactional
    public void markPublished(String eventId) {
        repository.findByIdForUpdate(eventId).ifPresent(event -> {
            event.setPublishStatus("PUBLISHED"); event.setPublishedAt(OffsetDateTime.now());
            event.setNextAttemptAt(null); event.setLastError(null);
        });
    }

    @Transactional
    public void markFailed(String eventId, Throwable failure) {
        repository.findByIdForUpdate(eventId).ifPresent(event -> {
            boolean exhausted = event.getAttemptCount() >= MAX_ATTEMPTS;
            event.setPublishStatus(exhausted ? "DEAD" : "FAILED");
            event.setNextAttemptAt(exhausted ? null : OffsetDateTime.now().plusSeconds(backoff(event.getAttemptCount())));
            String message = failure.getClass().getSimpleName() + ": " + String.valueOf(failure.getMessage());
            event.setLastError(message.substring(0, Math.min(message.length(), 2000)));
        });
    }

    private long backoff(int attempt) { return Math.min(900L, 5L * (1L << Math.min(attempt, 7))); }

    public record PublishInstruction(String eventId, String partitionKey, String eventType, String eventVersion,
                                     OffsetDateTime occurredAt, String correlationId, String causationId, String payload) {}
}
