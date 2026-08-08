package analyticsservice.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BookingOutcomeEventPayload(
        String bookingId,
        Long clusterId,
        Long showtimeId,
        Integer ticketCount,
        BigDecimal ticketAmount,
        BigDecimal concessionAmount,
        BigDecimal discountAmount,
        BigDecimal finalAmount,
        BigDecimal refundAmount,
        String currency) {
}
