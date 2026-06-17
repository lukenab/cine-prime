package authservice.producer;

import authservice.event.UserRegisteredEvent;
import authservice.event.UserUpdatedEvent;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class UserEventProducer {
    KafkaTemplate<String, Object> kafkaTemplate;

    public void sendRegisteredEvent(UserRegisteredEvent event){
        kafkaTemplate.send("user-register-topic", event);
    }

    public void sendUpdatedEvent(UserUpdatedEvent event){
        kafkaTemplate.send("user-update-topic", event);
    }
}

