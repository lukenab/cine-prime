package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ticket", indexes = {
        @Index(name = "idx_ticket_booking", columnList = "booking_id"),
        @Index(name = "idx_ticket_owner_status", columnList = "account_id,ticket_status")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Ticket {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "ticket_id", length = 50)
    String ticketId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    Booking booking;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_item_id", nullable = false, unique = true)
    BookingItem bookingDetail;

    @Column(name = "account_id", length = 50, nullable = false)
    String accountId;

    @Column(name = "showtime_id", nullable = false)
    Long showtimeId;

    @Column(name = "movie_name", length = 255, nullable = false)
    String movieName;

    @Column(name = "cluster_id")
    Long clusterId;

    @Column(name = "cluster_name", length = 255, nullable = false)
    String clusterName;

    @Column(name = "cinema_room_name", length = 255, nullable = false)
    String cinemaRoomName;

    @Column(name = "seat_code", length = 20, nullable = false)
    String seatCode;

    @Column(name = "seat_type", length = 50, nullable = false)
    String seatType;

    @Column(name = "price", precision = 15, scale = 2, nullable = false)
    BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(name = "ticket_status", length = 20, nullable = false)
    TicketStatus status;

    @Column(name = "checked_in_at")
    OffsetDateTime usedAt;

    @Column(name = "issued_by", length = 50)
    String issuedBy;

    @Version
    @Column(name = "version", nullable = false)
    Long version;

    @CreationTimestamp
    @Column(name = "issued_at", nullable = false, updatable = false)
    OffsetDateTime issuedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    OffsetDateTime updatedAt;

    @OneToMany(mappedBy = "ticket", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    List<TicketCheckIn> checkIns = new ArrayList<>();
}
