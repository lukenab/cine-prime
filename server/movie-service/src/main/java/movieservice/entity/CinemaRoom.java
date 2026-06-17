package movieservice.entity;

import java.time.OffsetDateTime;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "cinema_room")
public class CinemaRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cinema_room_id")
    private Long cinemaRoomId;

    @Column(name = "cinema_room_name")
    private String cinemaRoomName;

    @Column(name = "seat_quantity")
    private Integer seatQuantity;

    @Column(name = "status")
    private Boolean status;

    @OneToMany(mappedBy = "cinemaRoom", fetch = FetchType.LAZY)
    private List<Seat> seats;

    @OneToMany(mappedBy = "cinemaRoom", fetch = FetchType.EAGER)
    private List<ShowTime> showTimes;
}
