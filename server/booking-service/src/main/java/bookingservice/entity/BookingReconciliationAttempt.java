package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "booking_reconciliation_attempt", indexes = {
        @Index(name = "idx_reconciliation_attempt_case", columnList = "reconciliation_id,created_at")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingReconciliationAttempt {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "attempt_id", length = 50)
    String attemptId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reconciliation_id", nullable = false)
    BookingReconciliation reconciliation;

    @Column(name = "action_type", length = 100, nullable = false)
    String actionType;

    @Column(name = "attempt_status", length = 30, nullable = false)
    String status;

    @Column(name = "reason", length = 500, nullable = false)
    String reason;

    @Column(name = "requested_by", length = 50, nullable = false)
    String requestedBy;

    @Column(name = "before_snapshot", columnDefinition = "text")
    String beforeSnapshot;

    @Column(name = "after_snapshot", columnDefinition = "text")
    String afterSnapshot;

    @Column(name = "idempotency_key", length = 100, nullable = false, unique = true)
    String idempotencyKey;

    @Column(name = "last_error", columnDefinition = "text")
    String lastError;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    OffsetDateTime updatedAt;
}
