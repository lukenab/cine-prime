package movie.theater.common.event;

import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CanonicalEventEnvelopeTest {

    @Test
    void normalizesRequiredMetadataAndAllowsMissingCausation() {
        CanonicalEventEnvelope<Map<String, String>> event = new CanonicalEventEnvelope<>(
                " event-1 ", " BOOKING_CONFIRMED ", " 1 ",
                OffsetDateTime.parse("2026-08-02T10:15:30+07:00"),
                " correlation-1 ", " ", " booking-service ",
                Map.of("bookingId", "booking-1"));

        assertThat(event.eventId()).isEqualTo("event-1");
        assertThat(event.causationId()).isNull();
        assertThat(event.producer()).isEqualTo("booking-service");
    }

    @Test
    void rejectsIncompleteEnvelope() {
        assertThatThrownBy(() -> new CanonicalEventEnvelope<>(
                "", "BOOKING_CONFIRMED", "1", OffsetDateTime.now(),
                "correlation-1", null, "booking-service", Map.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("eventId");
    }
}
