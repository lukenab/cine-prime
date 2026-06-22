package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Entity
@Table(name = "booking", indexes = {
    @Index(name = "idx_booking_account",  columnList = "account_id"),
    @Index(name = "idx_booking_member",   columnList = "member_id"),
    @Index(name = "idx_booking_showtime", columnList = "showtime_id"),
    @Index(name = "idx_booking_status",   columnList = "status"),
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Booking {

    @Id
    @Column(name = "booking_id", length = 36)
    private String bookingId;                   // UUID, sinh trong service

    @Column(name = "account_id", nullable = false, length = 36)
    private String accountId;                   // ref auth_db.account

    @Column(name = "member_id", length = 10)
    private String memberId;                    // nullable — khách vãng lai

    @Column(name = "showtime_id", nullable = false)
    private Long showtimeId;                    // ref movie_db.show_time

    // ── Snapshot lịch chiếu ──────────────────────────────────
    @Column(name = "movie_name", length = 255)
    private String movieName;

    @Column(name = "show_date")
    private LocalDate showDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "cinema_room_name", length = 100)
    private String cinemaRoomName;

    // ── Tài chính ────────────────────────────────────────────
    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "points_used", nullable = false)
    @Builder.Default
    private Integer pointsUsed = 0;

    @Column(name = "points_discount", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal pointsDiscount = BigDecimal.ZERO;

    @Column(name = "final_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal finalAmount;

    // ── Metadata ─────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "booking_type", nullable = false, length = 20)
    private BookingType bookingType;            // ONLINE | COUNTER

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private BookingStatus status = BookingStatus.PENDING;

    @Column(name = "created_by", length = 36)
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;            // PENDING tự hủy nếu quá thời hạn

    // ── Quan hệ ──────────────────────────────────────────────
    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<BookingDetail> details;

    @OneToMany(mappedBy = "booking", fetch = FetchType.LAZY)
    private List<Ticket> tickets;

    // ── Enum inner ───────────────────────────────────────────
    public enum BookingType  { ONLINE, COUNTER }
    public enum BookingStatus {
        PENDING,    // đang giữ ghế, chưa xác nhận
        CONFIRMED,  // đã xác nhận tại quầy
        CANCELLED,  // đã hủy
        EXPIRED,    // quá 15 phút không xác nhận
        CONVERTED   // đã phát hành ticket
    }
}
