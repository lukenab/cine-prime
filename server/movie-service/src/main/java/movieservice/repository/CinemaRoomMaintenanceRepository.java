package movieservice.repository;

import movieservice.entity.CinemaRoomMaintenance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.time.LocalDateTime;

@Repository
public interface CinemaRoomMaintenanceRepository extends JpaRepository<CinemaRoomMaintenance, Long> {
    List<CinemaRoomMaintenance> findByCinemaRoom_CinemaRoomId(Long cinemaRoomId);
    List<CinemaRoomMaintenance> findByCinemaRoom_CinemaRoomIdAndResolvedFalse(Long cinemaRoomId);
    boolean existsByCinemaRoom_CinemaRoomId(Long cinemaRoomId);

    @Query("""
            SELECT CASE WHEN COUNT(maintenance) > 0 THEN TRUE ELSE FALSE END
            FROM CinemaRoomMaintenance maintenance
            WHERE maintenance.cinemaRoom.cinemaRoomId = :roomId
              AND maintenance.startedAt < :endAt
              AND (maintenance.resolvedAt IS NULL OR maintenance.resolvedAt > :startAt)
            """)
    boolean existsBlockingMaintenance(
            @Param("roomId") Long roomId,
            @Param("startAt") LocalDateTime startAt,
            @Param("endAt") LocalDateTime endAt);

    @Query("""
            SELECT maintenance
            FROM CinemaRoomMaintenance maintenance
            JOIN FETCH maintenance.cinemaRoom room
            JOIN FETCH room.cluster cluster
            WHERE room.cinemaRoomId IN :roomIds
              AND maintenance.startedAt < :toExclusive
              AND (maintenance.resolvedAt IS NULL OR maintenance.resolvedAt > :fromInclusive)
            """)
    List<CinemaRoomMaintenance> findBlockingMaintenanceInRange(
            @Param("roomIds") List<Long> roomIds,
            @Param("fromInclusive") LocalDateTime fromInclusive,
            @Param("toExclusive") LocalDateTime toExclusive);
}
