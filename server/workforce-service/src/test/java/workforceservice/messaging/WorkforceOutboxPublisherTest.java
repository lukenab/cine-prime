package workforceservice.messaging;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import workforceservice.service.WorkforceOutboxService;
import java.time.OffsetDateTime;
import java.util.concurrent.CompletableFuture;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class WorkforceOutboxPublisherTest {
    @Test
    void publishesCanonicalV1EnvelopeWithStableOutboxId() throws Exception {
        WorkforceOutboxService outbox = mock(WorkforceOutboxService.class);
        @SuppressWarnings("unchecked") KafkaTemplate<String, String> kafka = mock(KafkaTemplate.class);
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        WorkforceOutboxPublisher publisher = new WorkforceOutboxPublisher(outbox, kafka, mapper);
        ReflectionTestUtils.setField(publisher, "topic", "workforce.timesheet.events.v1");
        OffsetDateTime occurredAt = OffsetDateTime.parse("2026-08-20T10:00:00+07:00");
        when(outbox.claim("event-1")).thenReturn(new WorkforceOutboxService.PublishInstruction(
                "event-1", "account-1", "TIMESHEET_APPROVED", "1", occurredAt,
                "event-1", null, "{\"timesheetId\":\"sheet-1\",\"regularMinutes\":480}"));
        when(kafka.send(anyString(), anyString(), anyString())).thenReturn(CompletableFuture.completedFuture(null));

        publisher.publishOne("event-1");

        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(kafka).send(eq("workforce.timesheet.events.v1"), eq("account-1"), message.capture());
        JsonNode envelope = mapper.readTree(message.getValue());
        assertEquals("event-1", envelope.path("eventId").asText());
        assertEquals("TIMESHEET_APPROVED", envelope.path("eventType").asText());
        assertEquals("1", envelope.path("eventVersion").asText());
        assertEquals("workforce-service", envelope.path("producer").asText());
        assertEquals("sheet-1", envelope.path("payload").path("timesheetId").asText());
        verify(outbox).markPublished("event-1");
    }
}
