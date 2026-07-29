package paymentservice.dto;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;

@Value
@Builder
public class ReconciliationCaseResponse {
    Long caseId;
    String paymentId;
    String bookingId;
    String caseType;
    String severity;
    String status;
    String details;
    int attemptCount;
    OffsetDateTime createdAt;
}
