package bookingservice.dto.response;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;

@Value
@Builder
public class ReconciliationCaseResponse {
    String reconciliationId;
    String bookingId;
    String bookingCode;
    String caseType;
    String severity;
    String status;
    String paymentReference;
    String holdReference;
    Long clusterId;
    String evidence;
    String ownerId;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
