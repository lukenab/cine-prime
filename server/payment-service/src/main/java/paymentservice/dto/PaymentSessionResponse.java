package paymentservice.dto;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Value
@Builder
public class PaymentSessionResponse {
    String paymentId;
    String bookingId;
    String provider;
    String status;
    String paymentUrl;
    BigDecimal amount;
    String currency;
    OffsetDateTime expiresAt;
    String failureMessage;
    String bankCode;
    String cardType;
}
