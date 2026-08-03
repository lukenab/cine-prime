package bookingservice.dto.response;

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
    private String bookingId;
    private String providerRefundReference;
    private String status;
    private BigDecimal amount;
    private String currency;
    private OffsetDateTime completedAt;
    private boolean replayed;
}
