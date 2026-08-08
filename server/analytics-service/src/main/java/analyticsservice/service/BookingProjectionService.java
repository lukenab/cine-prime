package analyticsservice.service;

import analyticsservice.dto.BookingOutcomeEventPayload;
import analyticsservice.entity.BookingOutcomeStatus;
import analyticsservice.entity.BookingRevenueFact;
import analyticsservice.entity.ProcessedEvent;
import analyticsservice.repository.BookingRevenueFactRepository;
import analyticsservice.repository.ProcessedEventRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.event.CanonicalEventEnvelope;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingProjectionService {
    private static final String BOOKING_CONFIRMED = "BOOKING_CONFIRMED";
    private static final String BOOKING_REFUNDED = "BOOKING_REFUNDED";
    private static final String BOOKING_PRODUCER = "booking-service";
    private static final String SUPPORTED_VERSION = "2";

    private final ObjectMapper objectMapper;
    private final ProcessedEventRepository processedEventRepository;
    private final BookingRevenueFactRepository bookingRevenueFactRepository;
    private final ZoneId businessZone;

    @Transactional
    public ProjectionResult project(String message) {
        CanonicalEventEnvelope<JsonNode> envelope = parseEnvelope(message);
        if (!isSupported(envelope)) {
            return ProjectionResult.IGNORED;
        }
        if (processedEventRepository.existsBySourceEventId(envelope.eventId())) {
            return ProjectionResult.DUPLICATE;
        }

        BookingOutcomeEventPayload payload = parsePayload(envelope.payload());
        validate(envelope, payload);
        OffsetDateTime now = OffsetDateTime.now();
        BookingOutcomeStatus outcome = BOOKING_CONFIRMED.equals(envelope.eventType())
                ? BookingOutcomeStatus.CONFIRMED : BookingOutcomeStatus.REFUNDED;

        bookingRevenueFactRepository.save(BookingRevenueFact.builder()
                .sourceEventId(envelope.eventId())
                .eventVersion(envelope.eventVersion())
                .bookingId(payload.bookingId())
                .clusterId(payload.clusterId())
                .showtimeId(payload.showtimeId())
                .businessDate(envelope.occurredAt().atZoneSameInstant(businessZone).toLocalDate())
                .occurredAt(envelope.occurredAt())
                .projectedAt(now)
                .ticketCount(payload.ticketCount())
                .ticketAmount(money(payload.ticketAmount()))
                .concessionAmount(money(payload.concessionAmount()))
                .discountAmount(money(payload.discountAmount()))
                .finalAmount(money(payload.finalAmount()))
                .refundAmount(money(payload.refundAmount()))
                .currency(payload.currency().trim().toUpperCase(Locale.ROOT))
                .outcomeStatus(outcome)
                .build());
        processedEventRepository.save(ProcessedEvent.builder()
                .sourceEventId(envelope.eventId())
                .eventType(envelope.eventType())
                .processedAt(now)
                .build());
        return ProjectionResult.PROJECTED;
    }

    private boolean isSupported(CanonicalEventEnvelope<JsonNode> envelope) {
        return BOOKING_PRODUCER.equals(envelope.producer())
                && SUPPORTED_VERSION.equals(envelope.eventVersion())
                && (BOOKING_CONFIRMED.equals(envelope.eventType())
                || BOOKING_REFUNDED.equals(envelope.eventType()));
    }

    private CanonicalEventEnvelope<JsonNode> parseEnvelope(String message) {
        try {
            return objectMapper.readValue(message,
                    new TypeReference<CanonicalEventEnvelope<JsonNode>>() { });
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Invalid canonical booking event", exception);
        }
    }

    private BookingOutcomeEventPayload parsePayload(JsonNode payload) {
        try {
            return objectMapper.treeToValue(payload, BookingOutcomeEventPayload.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Invalid booking outcome payload", exception);
        }
    }

    private void validate(CanonicalEventEnvelope<JsonNode> envelope, BookingOutcomeEventPayload payload) {
        requireText(payload.bookingId(), "bookingId");
        if (payload.clusterId() == null || payload.showtimeId() == null || payload.ticketCount() == null
                || payload.ticketCount() < 0) {
            throw new IllegalArgumentException("Booking outcome identifiers and ticketCount are required");
        }
        if (payload.currency() == null || !payload.currency().matches("[A-Za-z]{3}")) {
            throw new IllegalArgumentException("Booking outcome currency must be a 3-letter code");
        }
        if (payload.ticketAmount() == null || payload.concessionAmount() == null || payload.discountAmount() == null
                || payload.finalAmount() == null || payload.refundAmount() == null) {
            throw new IllegalArgumentException("Booking outcome money fields are required");
        }
        if (money(payload.ticketAmount()).signum() < 0 || money(payload.concessionAmount()).signum() < 0
                || money(payload.discountAmount()).signum() < 0 || money(payload.finalAmount()).signum() < 0
                || money(payload.refundAmount()).signum() < 0) {
            throw new IllegalArgumentException("Booking outcome money fields cannot be negative");
        }
        if (BOOKING_CONFIRMED.equals(envelope.eventType()) && money(payload.refundAmount()).signum() != 0) {
            throw new IllegalArgumentException("A confirmed booking cannot carry a refund amount");
        }
    }

    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
    }

    private static BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    public enum ProjectionResult {
        PROJECTED,
        DUPLICATE,
        IGNORED
    }
}
