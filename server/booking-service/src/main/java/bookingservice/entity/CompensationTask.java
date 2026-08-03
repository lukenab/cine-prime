package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "compensation_task", indexes = {
        @Index(name = "idx_compensation_claim", columnList = "task_status,next_attempt_at"),
        @Index(name = "idx_compensation_booking", columnList = "booking_id")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CompensationTask {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "task_id", length = 50)
    String taskId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    Booking booking;

    @Column(name = "operation_name", length = 100, nullable = false)
    String taskType;

    @Column(name = "target_service", length = 100, nullable = false)
    String targetService;

    @Column(name = "target_reference", length = 255, nullable = false)
    String targetReference;

    @Column(name = "idempotency_key", length = 100, nullable = false, unique = true)
    String idempotencyKey;

    @Column(name = "task_status", length = 30, nullable = false)
    String status;

    @Column(name = "command_payload", columnDefinition = "text", nullable = false)
    String commandPayload;

    @Column(name = "correlation_id", length = 100, nullable = false)
    String correlationId;

    @Column(name = "attempt_count", nullable = false)
    @Builder.Default
    Integer attemptCount = 0;

    @Column(name = "next_attempt_at")
    OffsetDateTime nextAttemptAt;

    @Column(name = "claimed_by", length = 100)
    String claimedBy;

    @Column(name = "claim_until")
    OffsetDateTime claimUntil;

    @Column(name = "last_error", columnDefinition = "text")
    String lastError;

    @Version
    @Column(name = "version", nullable = false)
    Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    OffsetDateTime updatedAt;
}
