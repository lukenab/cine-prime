package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "booking_detail",
       indexes = @Index(name = "idx_booking_detail_booking", columnList = "booking_id"))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class BookingDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "detail_id")
    private Long detailId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @Column(name = "showtime_seat_id", nullable = false)
    private Long showtimeSeatId;                // ref movie_db.showtime_seat (cross-service)

    // ── Snapshot ghế ─────────────────────────────────────────
    @Column(name = "seat_code", nullable = false, length = 10)
    private String seatCode;

    @Column(name = "seat_type", nullable = false, length = 20)
    private String seatType;                    // NORMAL | VIP

    @Column(name = "unit_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "points_redeemed", nullable = false)
    @Builder.Default
    private Integer pointsRedeemed = 0;

    @Column(name = "is_from_points", nullable = false)
    @Builder.Default
    private Boolean isFromPoints = false;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;                       // optimistic locking

    // ── Quan hệ ──────────────────────────────────────────────
    @OneToOne(mappedBy = "bookingDetail", fetch = FetchType.LAZY)
    private Ticket ticket;
}
