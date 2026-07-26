package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "booking_cancellation", indexes = {
        @Index(name = "idx_cancellation_booking", columnList = "booking_id"),
        @Index(name = "idx_cancellation_status_created", columnList = "cancellation_status,requested_at")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingCancellation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "cancellation_id", length = 50)
    String cancellationId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    Booking booking;

    @Column(name = "idempotency_key", length = 100, nullable = false, unique = true)
    String idempotencyKey;

    @Column(name = "request_hash", length = 128, nullable = false)
    String requestHash;

    @Column(name = "source", length = 40, nullable = false)
    String source;

    @Column(name = "reason_code", length = 100, nullable = false)
    String reasonCode;

    @Column(name = "reason", length = 500)
    String reason;

    @Column(name = "actor_id", length = 50, nullable = false)
    String requestedBy;

    @Column(name = "correlation_id", length = 100, nullable = false)
    String correlationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "cancellation_status", length = 30, nullable = false)
    CancellationStatus status;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "refund_id", unique = true)
    Refund refund;

    @Column(name = "before_snapshot", columnDefinition = "text")
    String beforeSnapshot;

    @Column(name = "after_snapshot", columnDefinition = "text")
    String afterSnapshot;

    @CreationTimestamp
    @Column(name = "requested_at", nullable = false, updatable = false)
    OffsetDateTime requestedAt;

    @Column(name = "completed_at")
    OffsetDateTime completedAt;

    @Version
    @Column(name = "version", nullable = false)
    Long version;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    OffsetDateTime updatedAt;
}
