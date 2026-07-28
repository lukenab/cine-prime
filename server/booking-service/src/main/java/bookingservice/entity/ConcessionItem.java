package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "booking_concession_item", indexes = {
        @Index(name = "idx_concession_booking", columnList = "booking_id")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ConcessionItem {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "concession_item_id", length = 50)
    String concessionItemId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    Booking booking;

    @Column(name = "sku", length = 100, nullable = false)
    String sku;

    @Column(name = "item_name", length = 255, nullable = false)
    String itemName;

    @Column(name = "quantity", nullable = false)
    Integer quantity;

    @Column(name = "unit_price", precision = 15, scale = 2, nullable = false)
    BigDecimal unitPrice;

    @Column(name = "discount_amount", precision = 15, scale = 2, nullable = false)
    BigDecimal discountAmount;

    @Column(name = "final_amount", precision = 15, scale = 2, nullable = false)
    BigDecimal finalAmount;

    @Column(name = "fulfillment_cluster_id", nullable = false)
    Long fulfillmentClusterId;

    @Column(name = "external_reservation_id", length = 100)
    String externalReservationId;

    @Column(name = "reservation_status", length = 30, nullable = false)
    String status;

    @Column(name = "idempotency_key", length = 100, nullable = false, unique = true)
    String idempotencyKey;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    OffsetDateTime updatedAt;
}
