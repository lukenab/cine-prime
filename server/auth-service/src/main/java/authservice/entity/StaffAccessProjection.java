package authservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;

@Entity
@Table(name = "staff_access_projection")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffAccessProjection {
    @Id
    @Column(name = "account_id", length = 36, nullable = false, updatable = false)
    private String accountId;

    @Column(name = "account_role", length = 40, nullable = false)
    private String accountRole;

    @Column(name = "access_profile", length = 50, nullable = false)
    @ColumnDefault("'UNASSIGNED'")
    @Builder.Default
    private String accessProfile = "UNASSIGNED";

    @Column(name = "assignment_active", nullable = false)
    private boolean assignmentActive;

    @Column(name = "cinema_cluster_ids", length = 2000, nullable = false)
    @Builder.Default
    private String cinemaClusterIds = "";

    @Column(name = "last_event_id", length = 100, nullable = false)
    private String lastEventId;

    @Column(name = "last_event_version", length = 20, nullable = false)
    private String lastEventVersion;

    @Column(name = "last_assignment_version", nullable = false)
    private long lastAssignmentVersion;

    @Column(name = "last_event_occurred_at", nullable = false)
    private OffsetDateTime lastEventOccurredAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public List<String> clusterIds() {
        if (cinemaClusterIds == null || cinemaClusterIds.isBlank()) {
            return List.of();
        }
        return Arrays.stream(cinemaClusterIds.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
    }

    public void replaceClusterIds(List<String> clusterIds) {
        this.cinemaClusterIds = clusterIds == null ? "" : String.join(",", clusterIds);
    }
}
