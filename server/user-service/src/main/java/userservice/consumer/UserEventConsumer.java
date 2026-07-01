package userservice.consumer;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
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

    @KafkaListener(topics = "user-register-topic", groupId = "user-service-group")
    public void consumeRegisteredEvent(UserRegisteredEvent event){
        if (event == null) return;
        try {
            userService.createUserProfile(event);
        } catch (Exception e) {
            log.error("[KAFKA] Failed to process user-register-topic for accountId {}: {}", event.getAccountId(), e.getMessage(), e);
        }
    }

    @KafkaListener(topics = "user-update-topic", groupId = "user-service-group")
    public void consumeUpdatedEvent(UserUpdatedEvent event){
        if (event == null) return;
        userService.updateUserProfile(event);
    }
}
