package userservice.consumer;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import userservice.event.UserRegisteredEvent;
import userservice.event.UserUpdatedEvent;
import userservice.service.UserService;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class UserEventConsumer {
    UserService userService;

    /**
     * Xử lý UserRegisteredEvent từ auth-service.
     * KHÔNG dùng try-catch ở đây — để exception lan ra ngoài để Spring Kafka
     * DefaultErrorHandler có thể retry (3 lần, exponential backoff) trước khi
     * chuyển message sang Dead Letter Topic (user-register-topic.DLT).
     */
    @KafkaListener(topics = "user-register-topic", groupId = "user-service-group")
    public void consumeRegisteredEvent(UserRegisteredEvent event) {
        if (event == null) return;
        userService.createUserProfile(event);
    }

    @KafkaListener(topics = "user-update-topic", groupId = "user-service-group")
    public void consumeUpdatedEvent(UserUpdatedEvent event) {
        if (event == null) return;
        userService.updateUserProfile(event);
    }

    /**
     * Dead Letter Topic listener — nhận message đã thất bại sau tất cả các lần retry.
     * Trong production: gửi alert (Slack/PagerDuty) hoặc lưu vào bảng failed_events
     * để xử lý thủ công.
     */
    @KafkaListener(topics = "user-register-topic.DLT", groupId = "user-service-dlt-group")
    public void handleRegisteredEventDlt(ConsumerRecord<String, Object> record) {
        log.error("[DLT] ALERT: UserRegisteredEvent permanently failed after all retries. " +
                  "Manual intervention required. Payload: {}", record.value());
    }
}
