package workforceservice.entity;

import jakarta.persistence.*;
import lombok.*;
import workforceservice.domain.WorkforceEnums.ShiftStatus;
import java.time.OffsetDateTime;

@Entity @Table(name="employee_shift")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EmployeeShift {
    @Id @Column(name="shift_id", length=36) private String shiftId;
    @Column(name="roster_id", nullable=false, length=36) private String rosterId;
    @Column(name="account_id", nullable=false, length=36) private String accountId;
    @Column(name="cluster_id", nullable=false, length=36) private String clusterId;
    @Column(name="role_code", nullable=false, length=50) private String roleCode;
    @Column(name="starts_at", nullable=false) private OffsetDateTime startsAt;
    @Column(name="ends_at", nullable=false) private OffsetDateTime endsAt;
    @Column(name="break_minutes", nullable=false) private int breakMinutes;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=20) private ShiftStatus status;
    @Column(length=500) private String note;
    @Column(name="created_by", nullable=false, length=36) private String createdBy;
    @Column(name="created_at", nullable=false) private OffsetDateTime createdAt;
    @Column(name="updated_at", nullable=false) private OffsetDateTime updatedAt;
    @Version @Column(nullable=false) private long version;
}
