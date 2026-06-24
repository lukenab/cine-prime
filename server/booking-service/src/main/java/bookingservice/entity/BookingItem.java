package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "booking_detail")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class BookingItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "detail_id")
    private Long detailId;

    // --- PLAIN FIELDS ---
    @Column(name = "showtime_seat_id")
    private Long showtimeSeatId; 
    // ---------------------

    @Column(name = "seat_code", length = 20)
    private String seatCode;

    @Column(name = "seat_type", length = 50)
    private String seatType;

    @Column(name = "unit_price", precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "points_redeemed")
    private Integer pointsRedeemed;

    @Column(name = "is_from_points")
    private Boolean isFromPoints;

    @Version
    private Integer version;

    // QUAN HỆ NỘI BỘ TRONG SERVICE
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", referencedColumnName = "booking_id")
    private Booking booking;

    @OneToOne(mappedBy = "bookingDetail", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Ticket ticket;
}