package bookingservice.repository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import bookingservice.entity.SeatLock;

@Repository
public interface SeatLockRepository extends JpaRepository<SeatLock, Long> {
    Optional<SeatLock> findByShowtimeIdAndSeatId(Long showtimeId, Long seatId);
    void deleteByExpiresAtBefore(LocalDateTime now);
}