package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "ticket")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Ticket {

    @Id
    @Column(name = "ticket_id", length = 50)
    private String ticketId;

    // --- PLAIN FIELDS ---
    @Column(name = "showtime_id")
    private Long showtimeId;

    @Column(name = "account_id", length = 50)
    private String accountId;

    @Column(name = "member_id", length = 50)
    private String memberId;
    // ---------------------

    @Column(name = "movie_name")
    private String movieName;

    @Column(name = "cinema_room_name")
    private String cinemaRoomName;

    @Column(name = "show_date")
    private LocalDate showDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "seat_code", length = 20)
    private String seatCode;

    @Column(name = "seat_type", length = 50)
    private String seatType;

    @Column(name = "price", precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "is_from_points")
    private Boolean isFromPoints;

    @Column(name = "qr_code")
    private String qrCode;

    @Column(name = "status", length = 20)
    private String status;

    @CreationTimestamp
    @Column(name = "issued_at", updatable = false)
    private LocalDateTime issuedAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @Column(name = "issued_by")
    private String issuedBy;

    // QUAN HỆ NỘI BỘ TRONG SERVICE
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", referencedColumnName = "booking_id")
    private Booking booking;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "detail_id", referencedColumnName = "detail_id")
    private BookingItem bookingDetail;
}