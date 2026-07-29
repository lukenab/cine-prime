package paymentservice.dto;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Value
@Builder
public class PaymentOutcomePayload {
    String source;
    String eventId;
    String eventType;
    String bookingId;
    String paymentReference;
    BigDecimal amount;
    String currency;
    OffsetDateTime occurredAt;
}
