package movieservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import movieservice.entity.ShowtimeSeat;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShowtimeSeatRepository extends JpaRepository<ShowtimeSeat, Long> {
    List<ShowtimeSeat> findByShowTime_ShowTimeId(Long showtimeId);

    Optional<ShowtimeSeat> findByShowTime_ShowTimeIdAndSeat_SeatId(Long showtimeId, Long seatId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT s FROM ShowtimeSeat s
            WHERE s.showTime.showTimeId = :showtimeId
              AND s.showtimeSeatId IN :seatIds
            ORDER BY s.showtimeSeatId
            """)
    List<ShowtimeSeat> findAllByShowtimeAndIdsForUpdate(
            @Param("showtimeId") Long showtimeId,
            @Param("seatIds") List<Long> seatIds);

    @Query("""
            SELECT s FROM ShowtimeSeat s
            WHERE s.showTime.showTimeId = :showtimeId
              AND s.reservedBy = :ownerId
              AND s.holdIdempotencyKey = :idempotencyKey
            ORDER BY s.showtimeSeatId
            """)
    List<ShowtimeSeat> findByHoldOwnerAndIdempotencyKey(
            @Param("showtimeId") Long showtimeId,
            @Param("ownerId") String ownerId,
            @Param("idempotencyKey") String idempotencyKey);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ShowtimeSeat s
               SET s.status = movieservice.enums.ShowtimeSeatStatus.AVAILABLE,
                   s.reservedAt = NULL,
                   s.reservedExpiresAt = NULL,
                   s.holdId = NULL,
                   s.reservedBy = NULL,
                   s.holdIdempotencyKey = NULL,
                   s.version = s.version + 1
             WHERE s.status = movieservice.enums.ShowtimeSeatStatus.RESERVED
               AND s.reservedExpiresAt <= :now
            """)
    int releaseExpiredReservations(@Param("now") LocalDateTime now);
}
