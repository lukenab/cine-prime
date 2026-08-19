package authservice.messaging;

import authservice.service.StaffAccessProjectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class StaffAccessEventConsumer {
    private final StaffAccessProjectionService projectionService;

    @KafkaListener(
            topics = "${app.kafka.staff-access-topic:staff-access.events.v1}",
            groupId = "${app.kafka.staff-access-consumer-group:auth-staff-access-projection-v1}")
    public void consume(String message) {
        StaffAccessProjectionService.ProjectionResult result = projectionService.project(message);
        log.debug("Staff access event projection result={}", result);
    }
}
