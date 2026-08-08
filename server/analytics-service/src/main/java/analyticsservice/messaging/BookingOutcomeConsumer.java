package analyticsservice.messaging;

import analyticsservice.service.BookingProjectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class BookingOutcomeConsumer {
    private final BookingProjectionService projectionService;

    @KafkaListener(
            topics = "${analytics.kafka.booking-topic:booking.events.v1}",
            groupId = "${analytics.kafka.group-id:analytics-booking-projection-v1}")
    public void consume(String message) {
        BookingProjectionService.ProjectionResult result = projectionService.project(message);
        log.debug("Booking analytics event processed with result {}", result);
    }
}
