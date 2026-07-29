package bookingservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingOutboxPublisher {
    private final OutboxPublishingStateService stateService;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @Value("${booking.outbox.topic:booking.events.v1}")
    private String bookingEventsTopic;

    @Scheduled(fixedDelayString = "${booking.outbox.fixed-delay-ms:1000}")
    public void publishDueEvents() {
        stateService.dueEventIds().forEach(this::publishOne);
    }

    void publishOne(String eventId) {
        OutboxPublishingStateService.PublishInstruction instruction =
                stateService.claim(eventId);
        if (instruction == null) {
            return;
        }
        try {
            kafkaTemplate.send(
                            bookingEventsTopic,
                            instruction.partitionKey(),
                            instruction.payload())
                    .get(10, TimeUnit.SECONDS);
            stateService.markPublished(instruction.eventId());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            stateService.markFailed(instruction.eventId(), exception);
        } catch (RuntimeException exception) {
            stateService.markFailed(instruction.eventId(), exception);
        } catch (Exception exception) {
            stateService.markFailed(
                    instruction.eventId(),
                    new IllegalStateException("Kafka publication failed", exception));
        }
    }
}
