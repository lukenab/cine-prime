package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.SeatStatus;
import movieservice.enums.SeatType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "seat",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_seat_room_position",
                columnNames = {"cinema_room_id", "row_label", "col_number"}
        ))
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Seat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "seat_id")
    Long seatId;

    // Mã ghế rút gọn, e.g. "A1", "B12" — VARCHAR(10)
    @Column(name = "seat_code", nullable = false, length = 10)
    String seatCode;

    // Row label để render layout: A, B, C...
    @Column(name = "row_label", nullable = false, length = 3)
    String rowLabel;

    // Số thứ tự trong hàng: 1, 2, 3...
    @Column(name = "col_number", nullable = false)
    Integer colNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "seat_type", nullable = false, length = 20)
    SeatType seatType = SeatType.STANDARD;

    // Integer seatStatus → SeatStatus enum
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    SeatStatus status = SeatStatus.ACTIVE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cinema_room_id", nullable = false)
    CinemaRoom cinemaRoom;

    @Column(name = "base_price", nullable = false, precision = 10, scale = 2)
    BigDecimal price;

    // Danh dau 2 Seat thuoc cung 1 cap Couple sync tu RoomLayoutPosition khi activate
    // layout — null voi ghe sinh tu flow nhanh cu (khong co khai niem group rieng, van
    // dung SeatType.COUPLE + colSpan nhu truoc). Cho phep booking/locking nhan dien group.
    @Column(name = "seat_group_id", length = 36)
    String seatGroupId;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = SeatStatus.ACTIVE;
        if (seatType == null) seatType = SeatType.STANDARD;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
