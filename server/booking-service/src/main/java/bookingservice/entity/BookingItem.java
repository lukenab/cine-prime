package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Entity
@Table(name = "booking_item", uniqueConstraints = {
        @UniqueConstraint(name = "uk_booking_item_seat", columnNames = {"booking_id", "showtime_seat_id"})
}, indexes = {
        @Index(name = "idx_booking_item_booking", columnList = "booking_id"),
        @Index(name = "idx_booking_item_showtime_seat", columnList = "showtime_seat_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "booking_item_id", length = 50)
    String detailId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    Booking booking;

    @Column(name = "showtime_seat_id", nullable = false)
    Long showtimeSeatId;

    @Column(name = "seat_code", length = 20, nullable = false)
    String seatCode;

    @Column(name = "seat_type", length = 50, nullable = false)
    String seatType;

    @Column(name = "unit_price", precision = 15, scale = 2, nullable = false)
    BigDecimal unitPrice;

    @Column(name = "discount_amount", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "points_redeemed", nullable = false)
    @Builder.Default
    Integer pointsRedeemed = 0;

    @Column(name = "final_price", precision = 15, scale = 2, nullable = false)
    BigDecimal finalPrice;

    @Column(name = "is_from_points", nullable = false)
    @Builder.Default
    Boolean isFromPoints = false;

    @Version
    @Column(name = "version", nullable = false)
    Long version;

    @OneToOne(mappedBy = "bookingDetail", fetch = FetchType.LAZY)
    Ticket ticket;
}
