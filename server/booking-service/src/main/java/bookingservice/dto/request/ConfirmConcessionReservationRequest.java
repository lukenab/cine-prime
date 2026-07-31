package bookingservice.dto.request;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;

@Value
@Builder
public class ConfirmConcessionReservationRequest {
    String paymentId;
    OffsetDateTime paidAt;
}
