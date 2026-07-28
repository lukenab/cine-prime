package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.GenerationRunStatus;
import movieservice.enums.OptimizationScenario;
import movieservice.enums.OptimizerMode;
import movieservice.enums.SolverStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Table (name = "showtime_generation_run")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
public class ShowtimeGenerationRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "generation_run_id")
    Long generationRunId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "policy_id",  nullable = false)
    ShowtimeAllocationPolicy policy;

    @Column(name = "idempotency_key",  nullable = false, updatable = true, length = 128)
    String idempotencyKey;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    GenerationRunStatus status = GenerationRunStatus.ACCEPTED;

    @Column(name = "start_date",  nullable = false)
    LocalDate startDate;

    @Column(name = "end_date",   nullable = false)
    LocalDate endDate;

    @Builder.Default
    @Column(name = "candidate_count",   nullable = false)
    Integer candidateCount = 0;

    @Builder.Default
    @Column(name = "created_count",   nullable = false)
    Integer createdCount = 0;

    @Builder.Default
    @Column(name = "skipped_count", nullable = false)
    Integer skippedCount = 0;

    @Builder.Default
    @Column(name = "successful_partition_count", nullable = false)
    Integer successfulPartitionCount = 0;

    @Builder.Default
    @Column(name = "failed_partition_count", nullable = false)
    Integer failedPartitionCount = 0;

    @Column(name = "requested_by", nullable = false, length = 100)
    String requestedBy;

    @Column(name = "started_at")
    LocalDateTime startedAt;

    @Column(name = "completed_at")
    LocalDateTime completedAt;

    @Column(name = "failure_detail", columnDefinition = "TEXT")
    String failureDetail;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "optimizer_mode", nullable = false, length = 20)
    OptimizerMode optimizerMode = OptimizerMode.LEGACY;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "scenario", nullable = false, length = 20)
    OptimizationScenario scenario = OptimizationScenario.BALANCED;

    @Enumerated(EnumType.STRING)
    @Column(name = "solver_status", length = 20)
    SolverStatus solverStatus;

    @Column(name = "solve_duration_millis")
    Long solveDurationMillis;

    @Column(name = "objective_score", precision = 16, scale = 4)
    BigDecimal objectiveScore;

    /** Jackson-serialized {@link movieservice.service.autoshowtime.optimizer.ObjectiveBreakdown}. */
    @Column(name = "objective_breakdown", columnDefinition = "TEXT")
    String objectiveBreakdown;

    /** Jackson-serialized {@link movieservice.service.autoshowtime.optimizer.SolverDiagnostics}. */
    @Column(name = "solver_diagnostics", columnDefinition = "TEXT")
    String solverDiagnostics;

    /** Only populated in SHADOW_COMPARE mode - the non-primary optimizer's comparison output. */
    @Column(name = "shadow_comparison", columnDefinition = "TEXT")
    String shadowComparison;

    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    LocalDateTime updatedAt;

    // Hai table join này chỉ có FK, ko có các field riêng -> ManyToMany là hợp lí
    @Builder.Default
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "showtime_generation_run_movie",
            joinColumns = @JoinColumn(name = "generation_run_id"),
            inverseJoinColumns = @JoinColumn(name = "movie_id")
    )
    Set<Movie> movies = new LinkedHashSet<>();

    @Builder.Default
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "showtime_generation_run_cluster",
            joinColumns = @JoinColumn(name = "generation_run_id"),
            inverseJoinColumns = @JoinColumn(name = "cluster_id")
    )
    Set<CinemaCluster> clusters = new LinkedHashSet<>();

    @OneToMany(mappedBy = "generationRun", fetch = FetchType.LAZY)
    @OrderBy("showDate ASC, startTime ASC ")
    List<ShowTime> generateShowtimes;

    @OneToMany(mappedBy = "generationRun", fetch = FetchType.LAZY)
    @OrderBy("createdAt ASC")
    List<ShowtimeGenerationSkip> skips;

    @OneToOne(mappedBy = "generationRun", fetch = FetchType.LAZY)
    SchedulePlan schedulePlan;

    @PrePersist
    void prePersist(){
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;

        if(status == null) status = GenerationRunStatus.ACCEPTED;
        if(candidateCount == null) candidateCount = 0;
        if(skippedCount == null) skippedCount = 0;
        if(createdCount == null) createdCount = 0;
        if(successfulPartitionCount == null) successfulPartitionCount = 0;
        if(failedPartitionCount == null) failedPartitionCount = 0;
    }

    @PreUpdate
    void preUpdate(){
        updatedAt = LocalDateTime.now();
    }

}
