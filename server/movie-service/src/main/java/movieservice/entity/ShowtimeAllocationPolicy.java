package movieservice.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

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
    @Column(name = "planning_horizon_start_days", nullable = false)
    Integer planningHorizonStartDays = 3;

    @Builder.Default
    @Column(name = "planning_horizon_end_days", nullable = false)
    Integer planningHorizonEndDays = 9;

    @Builder.Default
    @Column(name = "cleanup_buffer_minutes", nullable = false)
    Integer cleanupBufferMinutes = 15;

    @Builder.Default
    @Column(name = "time_slot_interval_minutes", nullable = false)
    Integer timeSlotIntervalMinutes = 15;

    @Builder.Default
    @Column(name = "same_movie_stagger_minutes", nullable = false)
    Integer sameMovieStaggerMinutes = 20;

    @Builder.Default
    @Column(name = "max_solve_time_seconds", nullable = false)
    Integer maxSolveTimeSeconds = 30;

    @Builder.Default
    @Column(name = "solver_random_seed", nullable = false)
    Integer solverRandomSeed = 42;

    @Builder.Default
    @Column(name = "solver_search_workers", nullable = false)
    Integer solverSearchWorkers = 8;

    @Builder.Default
    @Column(name = "solver_relative_gap", nullable = false, precision = 6, scale = 4)
    BigDecimal solverRelativeGap = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "solver_log_search_progress", nullable = false)
    Boolean solverLogSearchProgress = false;

    /** Optional pruning cap; null means "no cap, prune only by hard eligibility." */
    @Column(name = "max_candidates_per_movie_per_day")
    Integer maxCandidatesPerMoviePerDay;

    @Builder.Default
    @Column(name = "optimizer_fallback_to_legacy_on_error", nullable = false)
    Boolean optimizerFallbackToLegacyOnError = true;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "default_optimizer_mode", nullable = false, length = 20)
    movieservice.enums.OptimizerMode defaultOptimizerMode = movieservice.enums.OptimizerMode.LEGACY;

    @Builder.Default
    @Column(name = "business_timezone", nullable = false, length = 50)
    String businessTimezone = "Asia/Ho_Chi_Minh";

    @Builder.Default
    @Column(name = "peak_start_time", nullable = false)
    LocalTime peakStartTime = LocalTime.of(18, 0);

    @Builder.Default
    @Column(name = "peak_end_time", nullable = false)
    LocalTime peakEndTime = LocalTime.of(22, 0);

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

    @OneToMany(mappedBy = "policy", fetch = FetchType.LAZY)
    List<ShowtimeAllocationFormatPriority> formatPriorities;

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
