package workforceservice.entity;

import jakarta.persistence.*;
import lombok.*;
import workforceservice.domain.WorkforceEnums.TimesheetStatus;
import java.time.*;

@Entity @Table(name="timesheet")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Timesheet {
    @Id @Column(name="timesheet_id", length=36) private String timesheetId;
    @Column(name="account_id", nullable=false, length=36) private String accountId;
    @Column(name="cluster_id", nullable=false, length=36) private String clusterId;
    @Column(name="period_start", nullable=false) private LocalDate periodStart;
    @Column(name="period_end", nullable=false) private LocalDate periodEnd;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=20) private TimesheetStatus status;
    @Column(name="regular_minutes", nullable=false) private int regularMinutes;
    @Column(name="overtime_minutes", nullable=false) private int overtimeMinutes;
    @Column(name="exception_count", nullable=false) private int exceptionCount;
    @Column(name="submitted_at") private OffsetDateTime submittedAt;
    @Column(name="reviewed_by", length=36) private String reviewedBy;
    @Column(name="reviewed_at") private OffsetDateTime reviewedAt;
    @Column(name="review_note", length=1000) private String reviewNote;
    @Column(name="created_at", nullable=false) private OffsetDateTime createdAt;
    @Column(name="updated_at", nullable=false) private OffsetDateTime updatedAt;
    @Version @Column(nullable=false) private long version;
}
