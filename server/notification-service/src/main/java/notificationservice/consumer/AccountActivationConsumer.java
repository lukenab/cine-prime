package notificationservice.consumer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import notificationservice.event.AccountActivationRequestedEvent;
import notificationservice.service.EmailService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AccountActivationConsumer {

    private final EmailService emailService;

    @KafkaListener(
            topics = "send-activation-email-topic",
            groupId = "notification-service-group"
    )
    public void handleAccountActivationRequested(AccountActivationRequestedEvent event) {
        log.info("Received AccountActivationRequestedEvent for email: {}", event.getEmail());
        emailService.sendAccountActivationEmail(
                event.getEmail(), event.getFullName(), event.getActivationLink(), event.getExpiryHours());
    }
}
