package bookingservice.service;

import bookingservice.entity.Booking;
import bookingservice.entity.OutboxEvent;
import bookingservice.repository.OutboxEventRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

import static bookingservice.exception.BookingErrorCode.SERVICE_UNAVAILABLE;

@Service
@RequiredArgsConstructor
public class BookingEventService {
    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public void append(Booking booking, String eventType, String correlationId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("bookingId", booking.getBookingId());
        payload.put("bookingCode", booking.getBookingCode());
        payload.put("accountId", booking.getAccountId());
        payload.put("showtimeId", booking.getShowtimeId());
        payload.put("clusterId", booking.getClusterId());
        payload.put("bookingStatus", booking.getStatus().name());
        payload.put("paymentStatus", booking.getPaymentStatus().name());
        payload.put("inventoryStatus", booking.getInventoryStatus().name());
        payload.put("total", booking.getFinalAmount());
        payload.put("currency", booking.getCurrency());

        try {
            outboxEventRepository.save(OutboxEvent.builder()
                    .booking(booking)
                    .aggregateType("BOOKING")
                    .aggregateId(booking.getBookingId())
                    .aggregateVersion(booking.getVersion() == null ? 0L : booking.getVersion())
                    .eventType(eventType)
                    .schemaVersion("1")
                    .correlationId(correlationId)
                    .partitionKey(booking.getBookingId())
                    .payload(objectMapper.writeValueAsString(payload))
                    .status("PENDING")
                    .build());
        } catch (JsonProcessingException exception) {
            throw new AppException(SERVICE_UNAVAILABLE);
        }
    }
}
