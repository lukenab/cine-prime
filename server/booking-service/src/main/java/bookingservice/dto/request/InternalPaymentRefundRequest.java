package bookingservice.dto.request;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InternalPaymentRefundRequest {
    private String bookingId;
    private String paymentReference;
    private BigDecimal amount;
    private String currency;
    private String reasonCode;
    private String reason;
    private String idempotencyKey;
}
