package workforceservice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.*;

@Entity @Table(name = "shift_template")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ShiftTemplate {
    @Id @Column(name="template_id", length=36) private String templateId;
    @Column(name="cluster_id", length=36) private String clusterId;
    @Column(nullable=false, length=100) private String name;
    @Column(name="start_time", nullable=false) private LocalTime startTime;
    @Column(name="end_time", nullable=false) private LocalTime endTime;
    @Column(name="break_minutes", nullable=false) private int breakMinutes;
    @Column(nullable=false) private boolean active;
    @Column(name="created_by", nullable=false, length=36) private String createdBy;
    @Column(name="created_at", nullable=false) private OffsetDateTime createdAt;
    @Column(name="updated_at", nullable=false) private OffsetDateTime updatedAt;
}
