package loyaltyservice.messaging;

import loyaltyservice.service.LoyaltyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class BookingEventConsumer {
    private final LoyaltyService loyaltyService;

    @KafkaListener(topics = "${loyalty.kafka.booking-topic:booking.events.v1}",
            groupId = "${loyalty.kafka.group-id:loyalty-booking-v1}")
    public void consume(String message) {
        loyaltyService.consume(message);
        log.debug("Loyalty booking event processed");
    }
}
