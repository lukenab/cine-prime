package workforceservice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;

@Entity @Table(name="workforce_audit_log")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WorkforceAuditLog {
    @Id @Column(name="audit_id", length=36) private String auditId;
    @Column(nullable=false, length=60) private String action;
    @Column(name="aggregate_type", nullable=false, length=40) private String aggregateType;
    @Column(name="aggregate_id", nullable=false, length=36) private String aggregateId;
    @Column(name="actor_account_id", nullable=false, length=36) private String actorAccountId;
    @Column(columnDefinition="text") private String details;
    @Column(name="occurred_at", nullable=false) private OffsetDateTime occurredAt;
}
