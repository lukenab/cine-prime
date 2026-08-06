package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.data.domain.Persistable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "booking", indexes = {
        @Index(name = "idx_booking_owner_created", columnList = "account_id,created_at"),
        @Index(name = "idx_booking_showtime", columnList = "showtime_id"),
        @Index(name = "idx_booking_status_expires", columnList = "booking_status,expires_at"),
        @Index(name = "idx_booking_cluster_created", columnList = "cluster_id,created_at")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Booking implements Persistable<String> {

    @Id
    @Column(name = "booking_id", length = 50)
    String bookingId;

    /**
     * Booking ID is assigned before Promotion Service reservation. Persistable
     * prevents Spring Data from treating that assigned UUID as a detached row
     * and issuing merge on the first save.
     */
    @Transient
    @Builder.Default
    boolean newBooking = true;

    @Column(name = "booking_code", length = 30, nullable = false, unique = true)
    String bookingCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "booking_type", length = 20, nullable = false)
    @Builder.Default
    BookingType bookingType = BookingType.ONLINE;

    @Column(name = "account_id", length = 50, nullable = false)
    String accountId;

    @Column(name = "member_id", length = 50)
    String memberId;

    @Column(name = "showtime_id", nullable = false)
    Long showtimeId;

    @Column(name = "movie_id")
    Long movieId;

    @Column(name = "movie_name", length = 255, nullable = false)
    String movieName;

    @Column(name = "cluster_id")
    Long clusterId;

    @Column(name = "cluster_name", length = 255, nullable = false)
    String clusterName;

    @Column(name = "cinema_room_id")
    Long cinemaRoomId;

    @Column(name = "cinema_room_name", length = 255, nullable = false)
    String cinemaRoomName;

    @Column(name = "show_date", nullable = false)
    LocalDate showDate;

    @Column(name = "start_time", nullable = false)
    LocalTime startTime;

    @Column(name = "showtime_timezone", length = 50, nullable = false)
    String showtimeTimezone;

    @Column(name = "hold_reference", length = 100, nullable = false, unique = true)
    String holdReference;

    @Column(name = "total_amount", precision = 15, scale = 2, nullable = false)
    BigDecimal totalAmount;

    @Column(name = "discount_amount", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "service_fee_amount", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    BigDecimal serviceFeeAmount = BigDecimal.ZERO;

    @Column(name = "points_used", nullable = false)
    @Builder.Default
    Integer pointsUsed = 0;

    @Column(name = "points_discount", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    BigDecimal pointsDiscount = BigDecimal.ZERO;

    @Column(name = "final_amount", precision = 15, scale = 2, nullable = false)
    BigDecimal finalAmount;

    /** Promotion snapshot becomes immutable once payment starts. */
    @Column(name = "promotion_id", length = 36)
    String promotionId;

    @Column(name = "promotion_code", length = 100)
    String promotionCode;

    @Column(name = "promotion_reservation_id", length = 36, unique = true)
    String promotionReservationId;

    @Column(name = "promotion_discount_amount", precision = 12, scale = 2)
    BigDecimal promotionDiscountAmount;

    @Column(name = "promotion_currency", length = 10)
    String promotionCurrency;

    @Column(name = "promotion_benefit_scope", length = 20)
    String promotionBenefitScope;

    @Column(name = "ticket_promotion_discount", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    BigDecimal ticketPromotionDiscount = BigDecimal.ZERO;

    @Column(name = "concession_promotion_discount", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    BigDecimal concessionPromotionDiscount = BigDecimal.ZERO;

    @Column(name = "currency", length = 3, nullable = false)
    @Builder.Default
    String currency = "VND";

    @Enumerated(EnumType.STRING)
    @Column(name = "booking_status", length = 30, nullable = false)
    BookingStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", length = 30, nullable = false)
    @Builder.Default
    PaymentStatus paymentStatus = PaymentStatus.NOT_STARTED;

    @Column(name = "payment_reference", length = 100, unique = true)
    String paymentReference;

    @Enumerated(EnumType.STRING)
    @Column(name = "refund_status", length = 30, nullable = false)
    @Builder.Default
    RefundStatus refundStatus = RefundStatus.NOT_REQUESTED;

    @Enumerated(EnumType.STRING)
    @Column(name = "inventory_status", length = 30, nullable = false)
    InventoryStatus inventoryStatus;

    @Column(name = "expires_at", nullable = false)
    OffsetDateTime expiresAt;

    @Column(name = "paid_at")
    OffsetDateTime paidAt;

    @Column(name = "concession_order_id", length = 50)
    String concessionOrderId;

    @Column(name = "concession_pickup_code", length = 20)
    String concessionPickupCode;

    @Column(name = "created_by", length = 50)
    String createdBy;

    @Version
    @Column(name = "version", nullable = false)
    Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    OffsetDateTime updatedAt;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    List<BookingItem> bookingDetails = new ArrayList<>();

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    List<ConcessionItem> concessionItems = new ArrayList<>();

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    List<Ticket> tickets = new ArrayList<>();

    @OneToOne(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    BookingTicketPass ticketPass;

    @OneToOne(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    InventoryReservation inventoryReservation;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    List<Refund> refunds = new ArrayList<>();

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    List<BookingCancellation> cancellations = new ArrayList<>();

    @PrePersist
    void assignIdIfMissing() {
        if (bookingId == null || bookingId.isBlank()) {
            bookingId = UUID.randomUUID().toString();
        }
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        newBooking = false;
    }

    @Override
    public String getId() {
        return bookingId;
    }

    @Override
    public boolean isNew() {
        return newBooking;
    }
}
