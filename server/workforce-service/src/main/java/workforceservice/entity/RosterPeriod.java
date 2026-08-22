package workforceservice.entity;

import jakarta.persistence.*;
import lombok.*;
import workforceservice.domain.WorkforceEnums.RosterStatus;
import java.time.*;

@Entity @Table(name="roster_period")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RosterPeriod {
    @Id @Column(name="roster_id", length=36) private String rosterId;
    @Column(name="cluster_id", nullable=false, length=36) private String clusterId;
    @Column(name="period_start", nullable=false) private LocalDate periodStart;
    @Column(name="period_end", nullable=false) private LocalDate periodEnd;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=20) private RosterStatus status;
    @Column(name="created_by", nullable=false, length=36) private String createdBy;
    @Column(name="published_by", length=36) private String publishedBy;
    @Column(name="published_at") private OffsetDateTime publishedAt;
    @Column(name="created_at", nullable=false) private OffsetDateTime createdAt;
    @Column(name="updated_at", nullable=false) private OffsetDateTime updatedAt;
    @Version @Column(nullable=false) private long version;
}
