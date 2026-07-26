package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "booking_audit_log", indexes = {
        @Index(name = "idx_booking_audit_booking", columnList = "booking_id,created_at"),
        @Index(name = "idx_booking_audit_correlation", columnList = "correlation_id")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingAuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "audit_id", length = 50)
    String auditId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    Booking booking;

    @Column(name = "action", length = 100, nullable = false)
    String action;

    @Column(name = "actor_id", length = 50, nullable = false)
    String actorId;

    @Column(name = "actor_type", length = 30, nullable = false)
    String actorType;

    @Column(name = "reason", length = 500)
    String reason;

    @Column(name = "before_snapshot", columnDefinition = "text")
    String beforeSnapshot;

    @Column(name = "after_snapshot", columnDefinition = "text")
    String afterSnapshot;

    @Column(name = "correlation_id", length = 100, nullable = false)
    String correlationId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    OffsetDateTime createdAt;
}
