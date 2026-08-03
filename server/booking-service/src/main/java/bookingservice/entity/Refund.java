package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "booking_refund", indexes = {
        @Index(name = "idx_refund_booking", columnList = "booking_id"),
        @Index(name = "idx_refund_status_created", columnList = "refund_status,created_at")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Refund {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "refund_id", length = 50)
    String refundId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    Booking booking;

    @Column(name = "payment_reference", length = 100, nullable = false)
    String paymentReference;

    @Column(name = "refund_reference", length = 100, unique = true)
    String refundReference;

    @Column(name = "idempotency_key", length = 100, nullable = false, unique = true)
    String idempotencyKey;

    @Column(name = "amount", precision = 15, scale = 2, nullable = false)
    BigDecimal amount;

    @Column(name = "cash_amount", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    BigDecimal cashAmount = BigDecimal.ZERO;

    @Column(name = "points_amount", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    BigDecimal pointsAmount = BigDecimal.ZERO;

    @Column(name = "promotion_amount", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    BigDecimal promotionAmount = BigDecimal.ZERO;

    @Column(name = "concession_amount", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    BigDecimal concessionAmount = BigDecimal.ZERO;

    @Column(name = "currency", length = 3, nullable = false)
    String currency;

    @Column(name = "reason_code", length = 100, nullable = false)
    String reasonCode;

    @Column(name = "reason", length = 500)
    String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "refund_status", length = 30, nullable = false)
    RefundStatus status;

    @Column(name = "completed_at")
    OffsetDateTime completedAt;

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
