package authservice.dto.response;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;

@Value
@Builder
public class AuditEventResponse {
    String auditId;
    String actorAccountId;
    String targetAccountId;
    String action;
    String status;
    String message;
    String ipAddress;
    String userAgent;
    String metadata;
    LocalDateTime createdAt;
}
