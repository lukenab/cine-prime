package workforceservice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;

@Entity
@Table(name = "workforce_employee_projection")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EmployeeProjection {
    @Id @Column(name = "account_id", length = 36) private String accountId;
    @Column(name = "account_role", nullable = false, length = 40) private String accountRole;
    @Column(name = "assignment_active", nullable = false) private boolean assignmentActive;
    @Column(name = "cinema_cluster_ids", nullable = false, length = 2000) @Builder.Default private String cinemaClusterIds = "";
    @Column(name = "last_event_id", nullable = false, length = 100) private String lastEventId;
    @Column(name = "last_event_version", nullable = false, length = 20) private String lastEventVersion;
    @Column(name = "last_assignment_version", nullable = false) private long lastAssignmentVersion;
    @Column(name = "last_event_occurred_at", nullable = false) private OffsetDateTime lastEventOccurredAt;
    @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt;

    public List<String> clusterIds() {
        if (cinemaClusterIds == null || cinemaClusterIds.isBlank()) return List.of();
        return Arrays.stream(cinemaClusterIds.split(",")).map(String::trim).filter(v -> !v.isBlank()).distinct().toList();
    }

    public void replaceClusterIds(List<String> values) {
        cinemaClusterIds = values == null ? "" : String.join(",", values);
    }
}
