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

    @Query("SELECT COUNT(s) > 0 FROM SeatLock s WHERE s.showtimeId = :showtimeId " +
           "AND s.seatId IN :seatIds AND s.expiresAt > :now")
    boolean existsActiveLocksOrBookings(
        @Param("showtimeId") Long showtimeId, 
        @Param("seatIds") List<Long> seatIds, 
        @Param("now") LocalDateTime now
    );

    @Query("SELECT s FROM SeatLock s WHERE s.showtimeId = :showtimeId AND s.expiresAt > :now")
    List<SeatLock> findAllActiveLocks(@Param("showtimeId") Long showtimeId, @Param("now") LocalDateTime now);

    @Query("SELECT COUNT(s) > 0 FROM SeatLock s WHERE s.showtimeId = :showtimeId AND s.seatId IN :seatIds AND s.expiresAt > :now")
    boolean existsByShowtimeIdAndSeatIdInAndExpiresAtAfter(@Param("showtimeId") Long showtimeId, @Param("seatIds") List<String> seatIds, @Param("now") LocalDateTime now);
    @Query("SELECT s FROM SeatLock s WHERE s.showtimeId = :showtimeId AND s.seatId IN :seatIds AND s.expiresAt > :now")
    List<SeatLock> findActiveLocks(
        @Param("showtimeId") Long showtimeId, 
        @Param("seatIds") List<String> seatIds, 
        @Param("now") LocalDateTime now
    );

    Optional<SeatLock> findByShowtimeIdAndSeatId(Long showtimeId, String seatId);

    void deleteByExpiresAtBefore(LocalDateTime now);

    @Modifying
    @Query("DELETE FROM SeatLock s WHERE s.showtimeId = :showtimeId AND s.seatId IN :seatCodes")
    void releaseSeatsByBookingAndList(
            @Param("showtimeId") Long showtimeId,
            @Param("seatCodes") List<String> seatCodes,
            @Param("bookingId") String bookingId);
}