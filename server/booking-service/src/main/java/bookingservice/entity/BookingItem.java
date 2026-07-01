package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Entity
@Table(name = "booking_detail")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class BookingItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "detail_id")
    Long detailId;


    @Column(name = "showtime_seat_id")
    Long showtimeSeatId; 


    @Column(name = "seat_code", length = 20)
    String seatCode;

    @Column(name = "seat_type", length = 50)
    String seatType;

    @Column(name = "unit_price", precision = 12, scale = 2)
    BigDecimal unitPrice;

    @Column(name = "points_redeemed")
    Integer pointsRedeemed;

    @Column(name = "is_from_points")
    Boolean isFromPoints;

    @Version
    Integer version;


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", referencedColumnName = "booking_id")
    Booking booking;

    @OneToOne(mappedBy = "bookingDetail", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    Ticket ticket;
}