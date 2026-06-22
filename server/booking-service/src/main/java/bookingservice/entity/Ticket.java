package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "ticket", indexes = {
    @Index(name = "idx_ticket_booking",  columnList = "booking_id"),
    @Index(name = "idx_ticket_member",   columnList = "member_id"),
    @Index(name = "idx_ticket_showtime", columnList = "showtime_id"),
    @Index(name = "idx_ticket_status",   columnList = "status"),
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Ticket {

    @Id
    @Column(name = "ticket_id", length = 36)
    private String ticketId;                    // UUID

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;                    // nullable — bán trực tiếp không qua booking

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "detail_id")
    private BookingDetail bookingDetail;

    @Column(name = "showtime_id", nullable = false)
    private Long showtimeId;

    // ── Snapshot thông tin vé (bất biến) ─────────────────────
    @Column(name = "movie_name", length = 255)
    private String movieName;

    @Column(name = "cinema_room_name", length = 100)
    private String cinemaRoomName;

    @Column(name = "show_date")
    private LocalDate showDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "seat_code", length = 10)
    private String seatCode;

    @Column(name = "seat_type", length = 20)
    private String seatType;

    @Column(name = "price", precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "is_from_points", nullable = false)
    @Builder.Default
    private Boolean isFromPoints = false;

    // ── Thông tin người mua ───────────────────────────────────
    @Column(name = "member_id", length = 10)
    private String memberId;

    @Column(name = "account_id", length = 36)
    private String accountId;

    @Column(name = "qr_code", length = 500)
    private String qrCode;

    // ── Trạng thái ───────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private TicketStatus status = TicketStatus.VALID;

    @Column(name = "issued_at", nullable = false)
    @Builder.Default
    private LocalDateTime issuedAt = LocalDateTime.now();

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @Column(name = "issued_by", length = 36)
    private String issuedBy;                    // account_id nhân viên phát vé

    public enum TicketStatus { VALID, USED, CANCELLED }
}
