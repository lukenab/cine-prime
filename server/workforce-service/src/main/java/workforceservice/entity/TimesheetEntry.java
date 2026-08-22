package workforceservice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;

@Entity @Table(name="timesheet_entry")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TimesheetEntry {
    @Id @Column(name="entry_id", length=36) private String entryId;
    @Column(name="timesheet_id", nullable=false, length=36) private String timesheetId;
    @Column(name="shift_id", nullable=false, unique=true, length=36) private String shiftId;
    @Column(name="actual_start") private OffsetDateTime actualStart;
    @Column(name="actual_end") private OffsetDateTime actualEnd;
    @Column(name="regular_minutes", nullable=false) private int regularMinutes;
    @Column(name="overtime_minutes", nullable=false) private int overtimeMinutes;
    @Column(name="payable_minutes", nullable=false) private int payableMinutes;
    @Column(name="created_at", nullable=false) private OffsetDateTime createdAt;
    @Column(name="updated_at", nullable=false) private OffsetDateTime updatedAt;
}
