package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "ticket")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class Ticket {

    @Id
    @Column(name = "ticket_id", length = 50)
    String ticketId;


    @Column(name = "showtime_id")
    Long showtimeId;

    @Column(name = "account_id", length = 50)
    String accountId;

    @Column(name = "member_id", length = 50)
    String memberId;


    @Column(name = "movie_name")
    String movieName;

    @Column(name = "cinema_room_name")
    String cinemaRoomName;

    @Column(name = "show_date")
    LocalDate showDate;

    @Column(name = "start_time")
    LocalTime startTime;

    @Column(name = "seat_code", length = 20)
    String seatCode;

    @Column(name = "seat_type", length = 50)
    String seatType;

    @Column(name = "price", precision = 12, scale = 2)
    BigDecimal price;

    @Column(name = "is_from_points")
    Boolean isFromPoints;

    @Column(name = "qr_code")
    String qrCode;

    @Column(name = "status", length = 20)
    String status;

    @CreationTimestamp
    @Column(name = "issued_at", updatable = false)
    LocalDateTime issuedAt;

    @Column(name = "used_at")
    LocalDateTime usedAt;

    @Column(name = "issued_by")
    String issuedBy;


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", referencedColumnName = "booking_id")
    Booking booking;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "detail_id", referencedColumnName = "detail_id")
    BookingItem bookingDetail;
}