package workforceservice.entity;

import jakarta.persistence.*;
import lombok.*;
import workforceservice.domain.WorkforceEnums.*;
import java.time.OffsetDateTime;

@Entity @Table(name="attendance_exception")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AttendanceException {
    @Id @Column(name="exception_id", length=36) private String exceptionId;
    @Column(name="entry_id", nullable=false, length=36) private String entryId;
    @Enumerated(EnumType.STRING) @Column(name="exception_code", nullable=false, length=30) private ExceptionCode exceptionCode;
    @Column(name="variance_minutes", nullable=false) private int varianceMinutes;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=20) private ExceptionStatus status;
    @Column(name="resolution_note", length=1000) private String resolutionNote;
    @Column(name="resolved_by", length=36) private String resolvedBy;
    @Column(name="resolved_at") private OffsetDateTime resolvedAt;
    @Column(name="created_at", nullable=false) private OffsetDateTime createdAt;
}
