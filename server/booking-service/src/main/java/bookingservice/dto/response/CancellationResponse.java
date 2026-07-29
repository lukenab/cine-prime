package bookingservice.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class CancellationResponse {
    String bookingId;
    String cancellationId;
    String bookingStatus;
    String cancellationStatus;
    String refundStatus;
    BigDecimal refundAmount;
    String currency;
    boolean replayed;
}
