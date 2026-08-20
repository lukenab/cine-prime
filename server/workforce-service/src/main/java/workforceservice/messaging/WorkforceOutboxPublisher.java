package workforceservice.messaging;

import com.fasterxml.jackson.databind.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.event.CanonicalEventEnvelope;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import workforceservice.service.WorkforceOutboxService;
import java.util.concurrent.TimeUnit;

@Slf4j @Component @RequiredArgsConstructor
public class WorkforceOutboxPublisher {
    private final WorkforceOutboxService outbox;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    @Value("${workforce.timesheet-topic:workforce.timesheet.events.v1}") private String topic;

    @Scheduled(fixedDelayString = "${workforce.outbox-poll-ms:1000}")
    public void publishDue() { outbox.dueIds().forEach(this::publishOne); }

    void publishOne(String eventId) {
        WorkforceOutboxService.PublishInstruction event = outbox.claim(eventId);
        if (event == null) return;
        try {
            JsonNode payload = objectMapper.readTree(event.payload());
            String message = objectMapper.writeValueAsString(new CanonicalEventEnvelope<>(event.eventId(), event.eventType(),
                    event.eventVersion(), event.occurredAt(), event.correlationId(), event.causationId(), "workforce-service", payload));
            kafkaTemplate.send(topic, event.partitionKey(), message).get(10, TimeUnit.SECONDS);
            outbox.markPublished(event.eventId());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt(); outbox.markFailed(event.eventId(), exception);
        } catch (Exception exception) {
            log.warn("Workforce outbox publish failed for event {}: {}", event.eventId(), exception.getMessage());
            outbox.markFailed(event.eventId(), exception);
        }
    }
}
