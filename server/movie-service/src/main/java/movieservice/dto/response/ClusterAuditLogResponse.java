package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ClusterAuditLogResponse {

    String logId;
    Long clusterId;
    /** CREATE | SUBMIT | APPROVE | REJECT | UPDATE | DEACTIVATE | REACTIVATE */
    String action;
    String performedBy;
    String oldStatus;
    String newStatus;
    String note;
    LocalDateTime timestamp;
}
