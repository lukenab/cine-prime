package movieservice.messaging;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movieservice.enums.SeatInventoryEventType;
import movieservice.websocket.SeatInventoryWebSocketHandler;

/**
 * Kafka-to-WebSocket fan-out. The consumer only forwards the three supported
 * inventory invalidation events; it never mutates or authorizes a seat hold.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SeatInventoryEventConsumer {

    private final ObjectMapper objectMapper;
    private final SeatInventoryWebSocketHandler webSocketHandler;

    @KafkaListener(
            topics = "${showtime.seat-hold.event-topic:seat.inventory.events.v1}",
            groupId = "${showtime.seat-hold.websocket-group:movie-service-seat-ws}")
    public void consume(String payload) {
        try {
            JsonNode event = objectMapper.readTree(payload);
            String eventType = event.path("eventType").asText();
            Long showtimeId = event.path("showtimeId").isNumber()
                    ? event.path("showtimeId").longValue()
                    : null;
            if (showtimeId == null || !SeatInventoryEventType.isSupported(eventType)) {
                log.warn("Ignored unsupported seat inventory event: {}", payload);
                return;
            }
            webSocketHandler.broadcast(showtimeId, payload);
        } catch (Exception exception) {
            log.error("Could not consume seat inventory event", exception);
        }
    }
}
