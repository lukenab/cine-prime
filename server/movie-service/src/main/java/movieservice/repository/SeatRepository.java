package movieservice.repository;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import movieservice.entity.Seat;
import movieservice.enums.SeatStatus;

public interface SeatRepository extends JpaRepository<Seat, Long> {

    List<Seat> findByCinemaRoomCinemaRoomId(Long cinemaRoomId);

    boolean existsByCinemaRoomCinemaRoomId(Long cinemaRoomId);

    @Query("SELECT MIN(s.price) FROM Seat s WHERE s.cinemaRoom.cinemaRoomId = :roomId AND s.status = :status")
    BigDecimal findMinPriceByCinemaRoomIdAndStatus(@Param("roomId") Long roomId, @Param("status") SeatStatus status);
}
