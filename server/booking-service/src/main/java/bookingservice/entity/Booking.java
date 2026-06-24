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
@Table(name = "booking")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Booking {

    @Id
    @Column(name = "booking_id", length = 50)
    private String bookingId;

    // --- PLAIN FIELDS (Không map quan hệ ra ngoài service) ---
    @Column(name = "account_id", length = 50)
    private String accountId;

    @Column(name = "member_id", length = 50)
    private String memberId;

    @Column(name = "showtime_id")
    private Long showtimeId;
    // ---------------------------------------------------------

    @Column(name = "movie_name")
    private String movieName;

    @Column(name = "show_date")
    private LocalDate showDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "cinema_room_name")
    private String cinemaRoomName;

    @Column(name = "total_amount", precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "points_used")
    private Integer pointsUsed;

    @Column(name = "points_discount", precision = 12, scale = 2)
    private BigDecimal pointsDiscount;

    @Column(name = "final_amount", precision = 12, scale = 2)
    private BigDecimal finalAmount;

    @Column(name = "booking_type")
    private String bookingType;

    @Column(name = "status", length = 20)
    private String status;

    @Column(name = "created_by")
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    // QUAN HỆ NỘI BỘ TRONG SERVICE
    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BookingItem> bookingDetails;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL)
    private List<Ticket> tickets;
}