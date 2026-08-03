package bookingservice.dto.response;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;

@Value
@Builder
public class TicketCheckInResponse {
    String bookingId;
    String bookingCode;
    Long clusterId;
    String result;
    String gateCode;
    OffsetDateTime checkedInAt;
    boolean replayed;
    List<String> seatCodes;
}
