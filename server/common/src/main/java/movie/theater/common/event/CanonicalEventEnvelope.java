package movie.theater.common.event;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.OffsetDateTime;
import java.util.Objects;

/**
 * Transport-only domain event contract shared by producers and consumers.
 *
 * <p>The payload remains owned by the producing bounded context. This type must
 * never be used as a shared persistence/JPA model.</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CanonicalEventEnvelope<T>(
        String eventId,
        String eventType,
        String eventVersion,
        OffsetDateTime occurredAt,
        String correlationId,
        String causationId,
        String producer,
        T payload) {

    public CanonicalEventEnvelope {
        eventId = requireText(eventId, "eventId");
        eventType = requireText(eventType, "eventType");
        eventVersion = requireText(eventVersion, "eventVersion");
        occurredAt = Objects.requireNonNull(occurredAt, "occurredAt is required");
        correlationId = requireText(correlationId, "correlationId");
        producer = requireText(producer, "producer");
        payload = Objects.requireNonNull(payload, "payload is required");
        causationId = normalizeOptional(causationId);
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return value.trim();
    }

    private static String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
