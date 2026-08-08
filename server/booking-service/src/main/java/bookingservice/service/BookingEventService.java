package bookingservice.service;

import bookingservice.entity.Booking;
import bookingservice.entity.OutboxEvent;
import bookingservice.dto.event.BookingOutcomeEventPayload;
import bookingservice.repository.OutboxEventRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.math.BigDecimal;

import static java.util.Objects.requireNonNullElse;

import static bookingservice.exception.BookingErrorCode.SERVICE_UNAVAILABLE;

@Service
@RequiredArgsConstructor
public class BookingEventService {
    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public void append(Booking booking, String eventType, String correlationId) {
        boolean analyticsOutcome = "BOOKING_CONFIRMED".equals(eventType)
                || "BOOKING_REFUNDED".equals(eventType);
        Object payload = analyticsOutcome
                ? outcomePayload(booking, "BOOKING_REFUNDED".equals(eventType))
                : legacyPayload(booking);
        appendOutbox(booking, eventType, correlationId, analyticsOutcome ? "2" : "1", payload);
    }

    private Map<String, Object> legacyPayload(Booking booking) {
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

        return payload;
    }

    private BookingOutcomeEventPayload outcomePayload(Booking booking, boolean refunded) {
        BigDecimal ticketAmount = booking.getBookingDetails().stream()
                .map(item -> requireNonNullElse(item.getFinalPrice(), BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal concessionAmount = booking.getConcessionItems().stream()
                .map(item -> requireNonNullElse(item.getFinalAmount(), BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discountAmount = requireNonNullElse(booking.getDiscountAmount(), BigDecimal.ZERO)
                .add(requireNonNullElse(booking.getPointsDiscount(), BigDecimal.ZERO));

        return BookingOutcomeEventPayload.builder()
                .accountId(booking.getAccountId())
                .bookingId(booking.getBookingId())
                .clusterId(booking.getClusterId())
                .showtimeId(booking.getShowtimeId())
                .ticketCount(booking.getBookingDetails().size())
                .ticketAmount(ticketAmount)
                .concessionAmount(concessionAmount)
                .discountAmount(discountAmount)
                .finalAmount(requireNonNullElse(booking.getFinalAmount(), BigDecimal.ZERO))
                .refundAmount(refunded
                        ? requireNonNullElse(booking.getFinalAmount(), BigDecimal.ZERO)
                        : BigDecimal.ZERO)
                .currency(requireNonNullElse(booking.getCurrency(), "VND"))
                .build();
    }

    private void appendOutbox(
            Booking booking,
            String eventType,
            String correlationId,
            String schemaVersion,
            Object payload) {
        try {
            outboxEventRepository.save(OutboxEvent.builder()
                    .booking(booking)
                    .aggregateType("BOOKING")
                    .aggregateId(booking.getBookingId())
                    .aggregateVersion(booking.getVersion() == null ? 0L : booking.getVersion())
                    .eventType(eventType)
                    .schemaVersion(schemaVersion)
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
