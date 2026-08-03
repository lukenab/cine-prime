package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.data.domain.Persistable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "booking")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
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
    @Column(name = "account_id", length = 50)
    String accountId;

    @Column(name = "member_id", length = 50)
    String memberId;

    @Column(name = "showtime_id")
    Long showtimeId;

    @Column(name = "movie_name")
    String movieName;

    @Column(name = "show_date")
    LocalDate showDate;

    @Column(name = "start_time")
    LocalTime startTime;

    @Column(name = "cinema_room_name")
    String cinemaRoomName;

    @Column(name = "total_amount", precision = 12, scale = 2)
    BigDecimal totalAmount;

    @Column(name = "points_used")
    Integer pointsUsed;

    @Column(name = "points_discount", precision = 12, scale = 2)
    BigDecimal pointsDiscount;

    @Column(name = "final_amount", precision = 12, scale = 2)
    BigDecimal finalAmount;

    /** Immutable promotion snapshot used for audit, refund and analytics. */
    @Column(name = "promotion_id", length = 36, updatable = false)
    String promotionId;

    @Column(name = "promotion_code", length = 100, updatable = false)
    String promotionCode;

    @Column(name = "promotion_reservation_id", length = 36, unique = true, updatable = false)
    String promotionReservationId;

    @Column(name = "promotion_discount_amount", precision = 12, scale = 2, updatable = false)
    BigDecimal promotionDiscountAmount;

    @Column(name = "promotion_currency", length = 10, updatable = false)
    String promotionCurrency;

    @Column(name = "booking_type")
    String bookingType;

    @Column(name = "status", length = 20)
    String status;

    @Column(name = "created_by")
    String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    @Column(name = "expires_at")
    LocalDateTime expiresAt;

    /** Authoritative temporary hold created by movie-service. */
    @Column(name = "seat_hold_id", length = 36, unique = true)
    String seatHoldId;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    List<BookingItem> bookingDetails;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL)
    List<Ticket> tickets;

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
