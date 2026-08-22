package workforceservice.entity;

import jakarta.persistence.*;
import lombok.*;
import workforceservice.domain.WorkforceEnums.PunchType;
import java.time.OffsetDateTime;

@Entity @Table(name="time_punch")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TimePunch {
    @Id @Column(name="punch_id", length=36) private String punchId;
    @Column(name="shift_id", nullable=false, length=36) private String shiftId;
    @Column(name="account_id", nullable=false, length=36) private String accountId;
    @Enumerated(EnumType.STRING) @Column(name="punch_type", nullable=false, length=20) private PunchType punchType;
    @Column(name="occurred_at", nullable=false) private OffsetDateTime occurredAt;
    @Column(name="recorded_at", nullable=false) private OffsetDateTime recordedAt;
    @Column(name="idempotency_key", nullable=false, unique=true, length=100) private String idempotencyKey;
    @Column(nullable=false, length=30) private String source;
}
