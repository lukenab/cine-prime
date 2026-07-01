package notificationservice.consumer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import notificationservice.event.OtpRequestedEvent;
import notificationservice.service.EmailService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class OtpEmailConsumer {

    private final EmailService emailService;

    @KafkaListener(
            topics = "send-otp-email-topic",
            groupId = "notification-service-group"
    )
    public void handleOtpRequested(OtpRequestedEvent event) {
        log.info("Received OtpRequestedEvent for email: {}", event.getEmail());
        emailService.sendOtpEmail(event.getEmail(), event.getOtp(), event.getExpiryMinutes());
    }
}
