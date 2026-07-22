package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.GenerationPartitionStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "showtime_generation_partition", uniqueConstraints = @UniqueConstraint(
        name = "uq_generation_partition_scope",
        columnNames = {"generation_run_id", "cluster_id", "business_date"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShowtimeGenerationPartition {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "partition_id") Long partitionId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "generation_run_id", nullable = false) ShowtimeGenerationRun generationRun;
    @Column(name = "cluster_id", nullable = false) Long clusterId;
    @Column(name = "business_date", nullable = false) LocalDate businessDate;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20) GenerationPartitionStatus status;
    @Builder.Default @Column(name = "slot_count", nullable = false) Integer slotCount = 0;
    @Column(name = "failure_code", length = 80) String failureCode;
    @Column(name = "failure_detail", columnDefinition = "TEXT") String failureDetail;
    @Builder.Default @Column(name = "attempt_count", nullable = false) Integer attemptCount = 1;
    @Column(name = "updated_at", nullable = false) LocalDateTime updatedAt;

    @PrePersist @PreUpdate void touch() { updatedAt = LocalDateTime.now(); }
}
