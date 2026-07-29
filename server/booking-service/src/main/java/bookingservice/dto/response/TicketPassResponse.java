package bookingservice.dto.response;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;

@Value
@Builder
public class TicketPassResponse {
    String bookingId;
    String bookingCode;
    String passToken;
    String status;
    Long clusterId;
    String clusterName;
    Long showtimeId;
    OffsetDateTime issuedAt;
    List<String> seatCodes;
}
