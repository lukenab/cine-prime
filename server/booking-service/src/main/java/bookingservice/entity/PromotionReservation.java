package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "promotion_reservation", indexes = {
        @Index(name = "idx_promotion_booking", columnList = "booking_id")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PromotionReservation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "promotion_reservation_id", length = 50)
    String promotionReservationId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    Booking booking;

    @Column(name = "promotion_id", length = 100, nullable = false)
    String promotionId;

    @Column(name = "promotion_code", length = 100)
    String promotionCode;

    @Column(name = "external_reservation_id", length = 100, nullable = false, unique = true)
    String externalReservationId;

    @Column(name = "discount_amount", precision = 15, scale = 2, nullable = false)
    BigDecimal discountAmount;

    @Column(name = "reservation_status", length = 30, nullable = false)
    String status;

    @Column(name = "expires_at")
    OffsetDateTime expiresAt;

    @Column(name = "idempotency_key", length = 100, nullable = false, unique = true)
    String idempotencyKey;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    OffsetDateTime updatedAt;
}
