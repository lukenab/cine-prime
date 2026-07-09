package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.ShowtimeSeatStatus;
import movieservice.enums.SeatType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "showtime_seat",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_showtime_seat", columnNames = {"showtime_id", "seat_id"}
    ),
    indexes = {
        @Index(name = "idx_ss_showtime", columnList = "showtime_id"),
        @Index(name = "idx_ss_status",   columnList = "showtime_id, status"),
        @Index(name = "idx_ss_booking",  columnList = "booking_id"),
        @Index(name = "idx_ss_expires",  columnList = "reserved_expires_at"),
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

    /** Snapshot tại thời điểm tạo suất — không thay đổi dù seat master thay đổi */
    @Column(name = "seat_code", nullable = false, length = 10)
    String seatCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "seat_type", nullable = false, length = 20)
    @Builder.Default
    SeatType seatType = SeatType.STANDARD;

    @Column(name = "price", nullable = false, precision = 10, scale = 2)
    BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    ShowtimeSeatStatus status = ShowtimeSeatStatus.AVAILABLE;

    @Column(name = "reserved_at")
    LocalDateTime reservedAt;

    /** Job scheduler quét mỗi 30s để giải phóng ghế RESERVED quá hạn */
    @Column(name = "reserved_expires_at")
    LocalDateTime reservedExpiresAt;

    /**
     * UUID của booking trong booking-service.
     * Không dùng FK vì cross-database — điền khi status chuyển SOLD.
     */
    @Column(name = "booking_id", length = 36)
    String bookingId;
}
