package bookingservice.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import bookingservice.entity.SeatLock;

@Repository
public interface SeatLockRepository extends JpaRepository<SeatLock, Long> {
    Optional<SeatLock> findByShowtimeIdAndSeatId(Long showtimeId, String seatId);
    void deleteByExpiresAtBefore(LocalDateTime now);

    @Modifying
    @Query("DELETE FROM SeatLock s WHERE s.showtimeId = :showtimeId AND s.seatId IN :seatIds")
    void releaseSeatsByList(
        @Param("showtimeId") Long showtimeId, 
        @Param("seatIds") List<String> seatIds
    );
}