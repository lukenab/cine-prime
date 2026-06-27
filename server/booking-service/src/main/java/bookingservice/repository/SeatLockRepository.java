package bookingservice.repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import bookingservice.entity.SeatLock;
import io.lettuce.core.dynamic.annotation.Param;
import jakarta.transaction.Transactional;

@Repository
public interface SeatLockRepository extends JpaRepository<SeatLock, Long> {
    Optional<SeatLock> findByShowtimeIdAndSeatId(Long showtimeId, Long seatId);
    void deleteByExpiresAtBefore(LocalDateTime now);
    @Modifying
    @Transactional
    @Query("DELETE FROM SeatLock s WHERE s.showtimeId = :showtimeId AND s.lockedByAccountId = :accountId")
    void releaseSeats(
        @Param("showtimeId") Long showtimeId, 
        @Param("accountId") String accountId
    );
}