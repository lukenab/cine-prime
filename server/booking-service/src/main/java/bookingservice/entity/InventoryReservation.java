package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "inventory_reservation", indexes = {
        @Index(name = "idx_inventory_status_expiry", columnList = "inventory_status,expires_at")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class InventoryReservation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "inventory_reservation_id", length = 50)
    String reservationId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false, unique = true)
    Booking booking;

    @Column(name = "hold_reference", length = 100, nullable = false, unique = true)
    String externalHoldId;

    @Column(name = "hold_token", length = 512, nullable = false, unique = true)
    String holdToken;

    @Enumerated(EnumType.STRING)
    @Column(name = "inventory_status", length = 30, nullable = false)
    InventoryStatus status;

    @Column(name = "expires_at", nullable = false)
    OffsetDateTime expiresAt;

    @Column(name = "confirmed_at")
    OffsetDateTime confirmedAt;

    @Column(name = "released_at")
    OffsetDateTime releasedAt;

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
