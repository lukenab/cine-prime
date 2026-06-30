package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "showtime_seat",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_showtime_seat", columnNames = {"showtime_id", "seat_id"}
    ),
    indexes = {
        @Index(name = "idx_showtime_seat_showtime", columnList = "showtime_id"),
        @Index(name = "idx_showtime_seat_status",   columnList = "showtime_id, status"),
    }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShowtimeSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "showtime_seat_id")
    Long showtimeSeatId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "showtime_id", nullable = false)
    ShowTime showTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seat_id", nullable = false)
    Seat seat;

    /** Snapshot — không đổi dù seat master thay đổi */
    @Column(name = "seat_code", nullable = false, length = 10)
    String seatCode;

    @Column(name = "seat_type", nullable = false, length = 20)
    String seatType;                    // NORMAL | VIP

    @Column(name = "price", nullable = false, precision = 10, scale = 2)
    BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    SeatStatus status = SeatStatus.AVAILABLE;

    @Column(name = "reserved_at")
    LocalDateTime reservedAt;

    /** Ghế tự động AVAILABLE lại khi vượt thời điểm này mà booking vẫn PENDING */
    @Column(name = "reserved_expires_at")
    LocalDateTime reservedExpiresAt;

    public enum SeatStatus { AVAILABLE, RESERVED, SOLD }
}
