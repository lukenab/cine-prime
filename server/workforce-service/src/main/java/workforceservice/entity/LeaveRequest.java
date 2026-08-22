package workforceservice.entity;

import jakarta.persistence.*;
import lombok.*;
import workforceservice.domain.WorkforceEnums.*;
import java.time.OffsetDateTime;

@Entity @Table(name="leave_request")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LeaveRequest {
    @Id @Column(name="request_id", length=36) private String requestId;
    @Column(name="account_id", nullable=false, length=36) private String accountId;
    @Column(name="cluster_id", nullable=false, length=36) private String clusterId;
    @Enumerated(EnumType.STRING) @Column(name="leave_type", nullable=false, length=30) private LeaveType leaveType;
    @Column(name="starts_at", nullable=false) private OffsetDateTime startsAt;
    @Column(name="ends_at", nullable=false) private OffsetDateTime endsAt;
    @Column(length=500) private String reason;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=20) private RequestStatus status;
    @Column(name="reviewed_by", length=36) private String reviewedBy;
    @Column(name="reviewed_at") private OffsetDateTime reviewedAt;
    @Column(name="review_note", length=1000) private String reviewNote;
    @Column(name="created_at", nullable=false) private OffsetDateTime createdAt;
    @Column(name="updated_at", nullable=false) private OffsetDateTime updatedAt;
}
