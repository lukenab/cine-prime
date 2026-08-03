package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "booking_reconciliation", indexes = {
        @Index(name = "idx_reconciliation_status_severity", columnList = "reconciliation_status,severity"),
        @Index(name = "idx_reconciliation_booking", columnList = "booking_id")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingReconciliation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "reconciliation_id", length = 50)
    String reconciliationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    Booking booking;

    @Column(name = "case_type", length = 100, nullable = false)
    String caseType;

    @Column(name = "severity", length = 30, nullable = false)
    String severity;

    @Enumerated(EnumType.STRING)
    @Column(name = "reconciliation_status", length = 30, nullable = false)
    ReconciliationStatus status;

    @Column(name = "payment_reference", length = 100)
    String paymentReference;

    @Column(name = "hold_reference", length = 100)
    String holdReference;

    @Column(name = "cluster_id")
    Long clusterId;

    @Column(name = "evidence", columnDefinition = "text", nullable = false)
    String evidence;

    @Column(name = "owner_id", length = 50)
    String ownerId;

    @Column(name = "created_by", length = 50, nullable = false)
    String createdBy;

    @Column(name = "correlation_id", length = 100, nullable = false)
    String correlationId;

    @Column(name = "idempotency_key", length = 100, nullable = false, unique = true)
    String idempotencyKey;

    @Version
    @Column(name = "version", nullable = false)
    Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    OffsetDateTime updatedAt;

    @OneToMany(mappedBy = "reconciliation", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    List<BookingReconciliationAttempt> attempts = new ArrayList<>();
}
