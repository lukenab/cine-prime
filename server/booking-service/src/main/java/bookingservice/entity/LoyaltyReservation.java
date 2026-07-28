package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "loyalty_reservation", indexes = {
        @Index(name = "idx_loyalty_booking", columnList = "booking_id")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LoyaltyReservation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "loyalty_reservation_id", length = 50)
    String loyaltyReservationId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false, unique = true)
    Booking booking;

    @Column(name = "external_reservation_id", length = 100, nullable = false, unique = true)
    String externalReservationId;

    @Column(name = "points_reserved", nullable = false)
    Integer pointsReserved;

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
