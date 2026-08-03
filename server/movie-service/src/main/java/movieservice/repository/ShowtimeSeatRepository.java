package movieservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.ShowtimeSeatStatus;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShowtimeSeatRepository extends JpaRepository<ShowtimeSeat, Long> {
    List<ShowtimeSeat> findByShowTime_ShowTimeId(Long showtimeId);

    Optional<ShowtimeSeat> findByShowTime_ShowTimeIdAndSeat_SeatId(Long showtimeId, Long seatId);

    @Query("""
            SELECT s FROM ShowtimeSeat s
            WHERE s.showTime.showTimeId = :showtimeId
              AND s.showtimeSeatId IN :seatIds
            ORDER BY s.showtimeSeatId
            """)
    List<ShowtimeSeat> findAllByShowtimeAndIds(
            @Param("showtimeId") Long showtimeId,
            @Param("seatIds") List<Long> seatIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT s FROM ShowtimeSeat s
            WHERE s.showTime.showTimeId = :showtimeId
              AND (
                    s.showtimeSeatId IN :seatIds
                    OR (s.seatGroupId IS NOT NULL AND s.seatGroupId IN :seatGroupIds)
              )
            ORDER BY s.showtimeSeatId
            """)
    List<ShowtimeSeat> findSelectionForUpdate(
            @Param("showtimeId") Long showtimeId,
            @Param("seatIds") List<Long> seatIds,
            @Param("seatGroupIds") List<String> seatGroupIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT s FROM ShowtimeSeat s
            WHERE s.showTime.showTimeId = :showtimeId
              AND s.holdId = :holdId
            ORDER BY s.showtimeSeatId
            """)
    List<ShowtimeSeat> findByShowtimeAndHoldIdForUpdate(
            @Param("showtimeId") Long showtimeId,
            @Param("holdId") String holdId);

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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT s FROM ShowtimeSeat s
            JOIN FETCH s.showTime st
            WHERE s.status = movieservice.enums.ShowtimeSeatStatus.RESERVED
              AND s.reservedExpiresAt <= :now
            ORDER BY st.showTimeId, s.holdId, s.showtimeSeatId
            """)
    List<ShowtimeSeat> findExpiredReservationsForUpdate(@Param("now") LocalDateTime now);

    @Query("""
            SELECT COUNT(DISTINCT s.holdId) FROM ShowtimeSeat s
            WHERE s.status = movieservice.enums.ShowtimeSeatStatus.RESERVED
              AND s.holdId IS NOT NULL
              AND s.reservedExpiresAt > CURRENT_TIMESTAMP
            """)
    long countActiveHolds();

    long countByShowTime_ShowTimeIdAndStatus(Long showtimeId, ShowtimeSeatStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT s FROM ShowtimeSeat s
            JOIN FETCH s.showTime st
            WHERE (s.status = movieservice.enums.ShowtimeSeatStatus.RESERVED
                    AND (s.holdId IS NULL OR s.reservedBy IS NULL OR s.reservedExpiresAt IS NULL))
               OR (s.status = movieservice.enums.ShowtimeSeatStatus.SOLD
                    AND s.bookingId IS NULL)
            ORDER BY st.showTimeId, s.showtimeSeatId
            """)
    List<ShowtimeSeat> findInventoryAnomalies();
}
