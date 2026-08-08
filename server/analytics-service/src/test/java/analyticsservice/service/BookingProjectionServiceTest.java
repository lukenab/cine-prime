package analyticsservice.service;

import analyticsservice.entity.BookingOutcomeStatus;
import analyticsservice.repository.BookingRevenueFactRepository;
import analyticsservice.repository.ProcessedEventRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import movie.theater.common.event.CanonicalEventEnvelope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class BookingProjectionServiceTest {
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private ProcessedEventRepository processedEvents;
    private BookingRevenueFactRepository facts;
    private BookingProjectionService service;

    @BeforeEach
    void setUp() {
        processedEvents = mock(ProcessedEventRepository.class);
        facts = mock(BookingRevenueFactRepository.class);
        service = new BookingProjectionService(objectMapper, processedEvents, facts, ZoneId.of("Asia/Ho_Chi_Minh"));
    }

    @Test
    void projectsConfirmedBookingWithoutPiiAndIsIdempotent() throws Exception {
        String message = event("evt-1", "BOOKING_CONFIRMED", Map.of(
                "bookingId", "booking-1", "clusterId", 81, "showtimeId", 42,
                "ticketCount", 2, "ticketAmount", 180000, "concessionAmount", 79000,
                "discountAmount", 20000, "finalAmount", 239000, "refundAmount", 0,
                "currency", "VND"));

        assertThat(service.project(message)).isEqualTo(BookingProjectionService.ProjectionResult.PROJECTED);
        verify(facts).save(argThat(fact -> fact.getOutcomeStatus() == BookingOutcomeStatus.CONFIRMED
                && fact.getTicketCount() == 2
                && fact.getFinalAmount().compareTo(new BigDecimal("239000")) == 0));
        verify(processedEvents).save(any());

        when(processedEvents.existsBySourceEventId("evt-1")).thenReturn(true);
        assertThat(service.project(message)).isEqualTo(BookingProjectionService.ProjectionResult.DUPLICATE);
        verify(facts, times(1)).save(any());
    }

    @Test
    void ignoresLegacyBookingEvents() throws Exception {
        String message = event("evt-legacy", "BOOKING_CONFIRMED", Map.of("bookingId", "booking-1"), "1");
        assertThat(service.project(message)).isEqualTo(BookingProjectionService.ProjectionResult.IGNORED);
        verifyNoInteractions(facts, processedEvents);
    }

    private String event(String id, String type, Object payload) throws Exception {
        return event(id, type, payload, "2");
    }

    private String event(String id, String type, Object payload, String version) throws Exception {
        return objectMapper.writeValueAsString(new CanonicalEventEnvelope<>(
                id, type, version, OffsetDateTime.parse("2026-08-07T09:00:00Z"),
                "corr-1", null, "booking-service", payload));
    }
}
