package workforceservice.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import workforceservice.service.EmployeeProjectionService;

@Component @RequiredArgsConstructor @Slf4j
public class StaffAccessEventConsumer {
    private final EmployeeProjectionService projectionService;

    @KafkaListener(topics="${workforce.staff-access-topic:staff-access.events.v1}", groupId="${spring.kafka.consumer.group-id:workforce-staff-projection-v1}")
    public void consume(String message) {
        log.debug("Workforce staff projection result={}", projectionService.project(message));
    }
}
