package bookingservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BookingOutboxPublisherTest {

    @Test
    void publishesCanonicalEnvelopeWithStableOutboxEventId() throws Exception {
        OutboxPublishingStateService state = mock(OutboxPublishingStateService.class);
        @SuppressWarnings("unchecked")
        KafkaTemplate<String, String> kafka = mock(KafkaTemplate.class);
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        BookingOutboxPublisher publisher = new BookingOutboxPublisher(state, kafka, mapper);
        ReflectionTestUtils.setField(publisher, "bookingEventsTopic", "booking.events.v1");

        OffsetDateTime occurredAt = OffsetDateTime.parse("2026-08-02T14:30:00+07:00");
        when(state.claim("evt-1")).thenReturn(
                new OutboxPublishingStateService.PublishInstruction(
                        "evt-1", "BKG-1", "BOOKING_CONFIRMED", "1",
                        occurredAt, "checkout-1", "payment-1",
                        "{\"bookingId\":\"BKG-1\",\"total\":263000,\"currency\":\"VND\"}"));
        when(kafka.send(
                org.mockito.ArgumentMatchers.eq("booking.events.v1"),
                org.mockito.ArgumentMatchers.eq("BKG-1"),
                org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        publisher.publishOne("evt-1");

        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(kafka).send(org.mockito.ArgumentMatchers.eq("booking.events.v1"),
                org.mockito.ArgumentMatchers.eq("BKG-1"), message.capture());
        JsonNode envelope = mapper.readTree(message.getValue());
        assertThat(envelope.path("eventId").asText()).isEqualTo("evt-1");
        assertThat(envelope.path("eventVersion").asText()).isEqualTo("1");
        assertThat(envelope.path("producer").asText()).isEqualTo("booking-service");
        assertThat(envelope.path("payload").path("bookingId").asText()).isEqualTo("BKG-1");
        assertThat(envelope.path("payload").path("total").decimalValue())
                .isEqualByComparingTo("263000");
        verify(state).markPublished("evt-1");
    }
}
