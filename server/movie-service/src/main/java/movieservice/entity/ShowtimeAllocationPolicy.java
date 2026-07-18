package movieservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "showtime_allocation_policy")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShowtimeAllocationPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "policy_id")
    Long policyId;

    @Column(name = "policy_code", nullable = false, unique = true, length = 50)
    String policyCode;

    @Column(name = "peak_demand_weight", nullable = false, precision = 6, scale = 4)
    BigDecimal peakDemandWeight;

    @Column(name = "movie_demand_weight", nullable = false, precision = 6, scale = 4)
    BigDecimal movieDemandWeight;

    @Column(name = "cluster_demand_weight", nullable = false, precision = 6, scale = 4)
    BigDecimal clusterDemandWeight;

    @Column(name = "time_slot_demand_weight", nullable = false, precision = 6, scale = 4)
    BigDecimal timeSlotDemandWeight;

    @Column(name = "format_demand_weight", nullable = false, precision = 6, scale = 4)
    BigDecimal formatDemandWeight;

    @Column(name = "room_capacity_weight", nullable = false, precision = 6, scale = 4)
    BigDecimal roomCapacityWeight;

    @Column(name = "minimum_coverage", nullable = false)
    Integer minimumCoverage;

    @Column(name = "maximum_room_share", nullable = false, precision = 5, scale = 4)
    BigDecimal maximumRoomShare;

    @Builder.Default
    @Column(nullable = false)
    Boolean active = true;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    @Column(name = "created_by", length = 100)
    String createdBy;

    @Column(name = "updated_by", length = 100)
    String updatedBy;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (active == null) active = true;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
