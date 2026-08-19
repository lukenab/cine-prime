package paymentservice.dto;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;

@Value
@Builder
public class RefundApprovalResponse {
    String requestId;
    String refundId;
    String bookingId;
    String status;
    String requestedBy;
    String reviewedBy;
    String executedBy;
    String requestNote;
    String decisionNote;
    OffsetDateTime submittedAt;
    OffsetDateTime reviewedAt;
    OffsetDateTime executedAt;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
