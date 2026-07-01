package bookingservice.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import bookingservice.entity.SeatLock;
import jakarta.persistence.LockModeType;

@Repository
public interface SeatLockRepository extends JpaRepository<SeatLock, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM SeatLock s WHERE s.showtimeId = :showtimeId AND s.seatId IN :seatIds")
    List<SeatLock> findByShowtimeIdAndSeatIdInForUpdate(
            @Param("showtimeId") Long showtimeId,
            @Param("seatIds") List<String> seatIds);

    @Modifying
    @Query("DELETE FROM SeatLock s WHERE s.showtimeId = :showtimeId AND s.seatId IN :seatCodes AND s.lockedByAccountId = :accountId")
    void releaseSeatsByAccountAndList(
            @Param("showtimeId") Long showtimeId,
            @Param("seatCodes") List<String> seatCodes,
            @Param("accountId") String accountId);
}