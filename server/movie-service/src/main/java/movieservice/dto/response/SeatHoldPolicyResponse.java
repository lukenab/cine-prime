package movieservice.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SeatHoldPolicyResponse {
    String channel;
    long ttlSeconds;
    int maxSeatsPerBooking;
}
