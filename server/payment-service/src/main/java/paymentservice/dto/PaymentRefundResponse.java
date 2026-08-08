package paymentservice.dto;

import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentRefundResponse {
    private String refundId;
    private String paymentId;
    private String bookingId;
    private String paymentReference;
    private String providerRefundReference;
    private String status;
    private BigDecimal amount;
    private String currency;
    private String reasonCode;
    private String reason;
    private String failureCode;
    private String failureMessage;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private OffsetDateTime completedAt;
    private boolean replayed;
}
