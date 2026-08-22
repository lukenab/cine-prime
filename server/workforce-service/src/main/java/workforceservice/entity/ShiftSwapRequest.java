package workforceservice.entity;

import jakarta.persistence.*;
import lombok.*;
import workforceservice.domain.WorkforceEnums.RequestStatus;
import java.time.OffsetDateTime;

@Entity @Table(name="shift_swap_request")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ShiftSwapRequest {
    @Id @Column(name="request_id", length=36) private String requestId;
    @Column(name="source_shift_id", nullable=false, length=36) private String sourceShiftId;
    @Column(name="requested_by", nullable=false, length=36) private String requestedBy;
    @Column(name="target_account_id", nullable=false, length=36) private String targetAccountId;
    @Column(length=500) private String reason;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=20) private RequestStatus status;
    @Column(name="reviewed_by", length=36) private String reviewedBy;
    @Column(name="reviewed_at") private OffsetDateTime reviewedAt;
    @Column(name="review_note", length=1000) private String reviewNote;
    @Column(name="created_at", nullable=false) private OffsetDateTime createdAt;
    @Column(name="updated_at", nullable=false) private OffsetDateTime updatedAt;
}
