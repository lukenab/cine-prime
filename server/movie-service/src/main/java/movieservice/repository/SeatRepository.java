package movieservice.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import movieservice.entity.Seat;

public interface SeatRepository extends JpaRepository<Seat, Long> {

    List<Seat> findByCinemaRoomCinemaRoomId(Long cinemaRoomId);
}
