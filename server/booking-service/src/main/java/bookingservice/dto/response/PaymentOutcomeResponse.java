package bookingservice.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class PaymentOutcomeResponse {
    String eventId;
    String bookingId;
    String bookingStatus;
    String paymentStatus;
    boolean replayed;
    boolean reconciliationRequired;
}
