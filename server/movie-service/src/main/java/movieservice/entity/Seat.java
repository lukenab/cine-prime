package movieservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import movieservice.enums.SeatType;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "seat")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Seat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "seat_id")
    Long seatId;

    @Column(name = "seat_code", nullable = false)
    String seatCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "seat_type", length = 20)
    SeatType seatType;

    @Column(name = "seat_status", nullable = false)
    Integer seatStatus = 1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cinema_room_id")
    CinemaRoom cinemaRoom;

    @Column(name = "price", nullable = false, precision = 10, scale = 2)
    BigDecimal price;

    @Column(name = "created_at", updatable = false)
    OffsetDateTime createdAt;

    @Column(name = "updated_at")
    OffsetDateTime updatedAt;
}