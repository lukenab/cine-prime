package authservice.messaging;

import authservice.event.OtpRequestedEvent;
import authservice.event.UserRegisteredEvent;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movie.theater.common.exception.GlobalErrorCode;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AuthEventPublisher {
    KafkaTemplate<String, Object> kafkaTemplate;

    public void sendRegisteredEvent(UserRegisteredEvent event){
        sendAndWait("user-register-topic", event);
    }
    
    public void sendOtpRequestedEvent(OtpRequestedEvent event) {
        kafkaTemplate.send("send-otp-email-topic", event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish OtpRequestedEvent for email {}: {}", event.getEmail(), ex.getMessage());
                    } else {
                        log.info("Published OtpRequestedEvent to send-otp-email-topic for email: {}", event.getEmail());
                    }
                });
    }

    private void sendAndWait(String topic, Object event) {
        try {
            kafkaTemplate.send(topic, event).get(5, TimeUnit.SECONDS);
            log.info("Published event to topic {}: {}", topic, event);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Interrupted while publishing event to topic {}", topic, e);
            throw new AppException(GlobalErrorCode.UNCATEGORIZED_EXCEPTION);
        } catch (ExecutionException | TimeoutException e) {
            log.error("Failed to publish event to topic {}", topic, e);
            throw new AppException(GlobalErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }
}

