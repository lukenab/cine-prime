package bookingservice.dto.request;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;

@Value
@Builder
public class ConcessionReservationRequest {
    String bookingId;
    String customerId;
    Long cinemaClusterId;
    List<AttachConcessionsRequest.Item> items;
    String idempotencyKey;
    OffsetDateTime checkoutExpiresAt;
}
