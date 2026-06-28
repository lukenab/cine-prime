package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Entity
@Table(name = "booking")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class Booking {

    @Id
    @Column(name = "booking_id", length = 50)
    String bookingId;
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
    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    List<BookingItem> bookingDetails;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL)
    List<Ticket> tickets;
}