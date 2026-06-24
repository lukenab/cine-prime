package movieservice.entity;

import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Entity
@Table(name = "cinema_room")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cinema_room_id")
    Long cinemaRoomId;

    @Column(name = "cinema_room_name")
    String cinemaRoomName;

    @Column(name = "seat_quantity")
    Integer seatQuantity;

    @Column(name = "status")
    Boolean status;

    @OneToMany(mappedBy = "cinemaRoom", fetch = FetchType.LAZY)
    List<Seat> seats;

    @OneToMany(mappedBy = "cinemaRoom", fetch = FetchType.EAGER)
    List<ShowTime> showTimes;
}
