package movieservice.service;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movieservice.enums.SeatInventoryEventType;

/**
 * Transactional outbox for seat inventory events.
 *
 * <p>Business transactions only append an outbox row. A background publisher
 * later sends the durable event to Kafka. This keeps the database authoritative
 * and avoids reporting a seat change that was rolled back.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SeatInventoryOutboxService {

    private static final int BATCH_SIZE = 100;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final Clock clock;

    @Value("${showtime.seat-hold.event-topic:seat.inventory.events.v1}")
    private String eventTopic;

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(
            SeatInventoryEventType type,
            Long showtimeId,
            String holdId,
            List<Long> seatIds,
            LocalDateTime expiresAt,
            String bookingId) {
        UUID eventId = UUID.randomUUID();
        LocalDateTime occurredAt = LocalDateTime.now(clock);
        String aggregateId = holdId == null || holdId.isBlank()
                ? "showtime-" + showtimeId + "-" + eventId
                : holdId;
        String payload = json(Map.of(
                "eventId", eventId.toString(),
                "eventType", type.getWireName(),
                "showtimeId", showtimeId,
                "holdId", holdId == null ? "" : holdId,
                "seatIds", seatIds,
                "expiresAt", expiresAt == null ? "" : expiresAt.toString(),
                "bookingId", bookingId == null ? "" : bookingId,
                "occurredAt", occurredAt.toString()));

        jdbcTemplate.update("""
                INSERT INTO seat_inventory_outbox (
                    event_id, event_type, aggregate_type, aggregate_id,
                    showtime_id, payload, status, attempts, occurred_at
                ) VALUES (?, ?, 'SHOWTIME_SEAT_HOLD', ?, ?, ?, 'PENDING', 0, ?)
                """,
                eventId,
                type.getWireName(),
                aggregateId,
                showtimeId,
                payload,
                Timestamp.valueOf(occurredAt));
    }

    /**
     * Publishes a bounded batch. Delivery is at-least-once; clients therefore
     * treat the event as an invalidation signal and reload the REST seat map.
     */
    @Transactional
    public int publishPending() {
        List<OutboxRow> rows = jdbcTemplate.query("""
                SELECT event_id, showtime_id, payload
                FROM seat_inventory_outbox
                WHERE status = 'PENDING'
                ORDER BY occurred_at
                FOR UPDATE SKIP LOCKED
                LIMIT ?
                """,
                (resultSet, rowNum) -> new OutboxRow(
                        resultSet.getObject("event_id", UUID.class),
                        resultSet.getLong("showtime_id"),
                        resultSet.getString("payload")),
                BATCH_SIZE);

        int published = 0;
        for (OutboxRow row : rows) {
            try {
                kafkaTemplate.send(eventTopic, String.valueOf(row.showtimeId()), row.payload())
                        .get(5, TimeUnit.SECONDS);
                jdbcTemplate.update("""
                        UPDATE seat_inventory_outbox
                        SET status = 'PUBLISHED',
                            attempts = attempts + 1,
                            published_at = CURRENT_TIMESTAMP,
                            last_error = NULL
                        WHERE event_id = ?
                        """, row.eventId());
                published++;
            } catch (Exception exception) {
                String message = exception.getMessage() == null
                        ? exception.getClass().getSimpleName()
                        : exception.getMessage();
                jdbcTemplate.update("""
                        UPDATE seat_inventory_outbox
                        SET attempts = attempts + 1,
                            last_error = ?
                        WHERE event_id = ?
                        """, abbreviate(message), row.eventId());
                log.warn("Seat inventory outbox publish failed for event {}: {}",
                        row.eventId(), message);
            }
        }
        return published;
    }

    private String json(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize seat inventory event", exception);
        }
    }

    private String abbreviate(String value) {
        return value.length() <= 1000 ? value : value.substring(0, 1000);
    }

    private record OutboxRow(UUID eventId, Long showtimeId, String payload) {
    }
}
