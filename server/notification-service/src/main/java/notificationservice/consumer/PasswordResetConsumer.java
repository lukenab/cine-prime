package notificationservice.consumer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import notificationservice.event.PasswordResetRequestedEvent;
import notificationservice.service.EmailService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class PasswordResetConsumer {
    private final EmailService emailService;

    @KafkaListener(topics = "send-password-reset-email-topic", groupId = "notification-service-group")
    public void handle(PasswordResetRequestedEvent event) {
        log.info("Received password reset email request for {}", event.getEmail());
        emailService.sendPasswordResetEmail(
                event.getEmail(), event.getResetLink(), event.getExpiryMinutes());
    }
}
