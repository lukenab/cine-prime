package bookingservice.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import bookingservice.entity.SeatLock;
import io.lettuce.core.dynamic.annotation.Param;
import jakarta.persistence.LockModeType;

@Repository
public interface SeatLockRepository extends JpaRepository<SeatLock, Long> {

        @Modifying
        @Query("DELETE FROM SeatLock s WHERE s.showtimeId = :showtimeId AND s.seatId IN :seatIds")
        void releaseSeatsByList(
                        @Param("showtimeId") Long showtimeId,
                        @Param("seatIds") List<String> seatIds);

        @Query("SELECT COUNT(s) > 0 FROM SeatLock s WHERE s.showtimeId = :showtimeId " +
                        "AND s.seatId IN :seatIds AND s.expiresAt > :now")
        boolean existsActiveLocksOrBookings(
                        @Param("showtimeId") Long showtimeId,
                        @Param("seatIds") List<Long> seatIds,
                        @Param("now") LocalDateTime now);

        @Query("SELECT s FROM SeatLock s WHERE s.showtimeId = :showtimeId AND s.expiresAt > :now")
        List<SeatLock> findAllActiveLocks(@Param("showtimeId") Long showtimeId, @Param("now") LocalDateTime now);

        boolean existsByShowtimeIdAndSeatIdIn(Long showtimeId, List<String> seatIds);

        @Query("SELECT s FROM SeatLock s WHERE s.showtimeId = :showtimeId AND s.seatId IN :seatIds AND s.expiresAt > :now")
        List<SeatLock> findActiveLocks(
                        @Param("showtimeId") Long showtimeId,
                        @Param("seatIds") List<String> seatIds,
                        @Param("now") LocalDateTime now);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("SELECT s FROM SeatLock s WHERE s.showtimeId = :showtimeId AND s.seatId IN :seatIds")
        List<SeatLock> findByShowtimeIdAndSeatIdInForUpdate(
                        @Param("showtimeId") Long showtimeId,
                        @Param("seatIds") List<String> seatIds);

        @Modifying
        @Query("DELETE FROM SeatLock s WHERE s.showtimeId = :showtimeId AND s.seatId IN :seatIds AND s.expiresAt <= :now")
        void deleteExpiredLocks(@Param("showtimeId") Long showtimeId,
                        @Param("seatIds") List<String> seatIds,
                        @Param("now") LocalDateTime now);
}