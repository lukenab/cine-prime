package movieservice.repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import movieservice.entity.ShowTime;

public interface ShowTimeRepository extends JpaRepository<ShowTime, Long> {

        @Query("SELECT COUNT(s) > 0 FROM ShowTime s WHERE s.cinemaRoom.cinemaRoomId = :roomId " +
                        "AND s.showDate = :showDate " +
                        "AND s.status <> movieservice.enums.ShowTimeStatus.CANCELLED " +
                        "AND :startTime < s.endTime AND :endTime > s.startTime")
        boolean existsByCinemaRoomAndOverlappingTime(
                        @Param("roomId") Long roomId,
                        @Param("showDate") LocalDate showDate,
                        @Param("startTime") LocalTime startTime,
                        @Param("endTime") LocalTime endTime);

        /// Kiểm tra buffer giữa showtime đã tồn tại và candidate AUTO bằng native PostgreSQL.
        /// JPQL không hỗ trợ cộng interval vào TIME một cách portable.
        @Query(value = """
                        SELECT EXISTS (
                            SELECT 1
                            FROM show_time s
                            WHERE s.cinema_room_id = :roomId
                              AND s.show_date = :showDate
                              AND s.status <> 'CANCELLED'
                              AND CAST(:startTime AS time) < s.end_time
                                  + (CAST(:cleanupBufferMinutes AS integer) * INTERVAL '1 minute')
                              AND s.start_time < CAST(:endTime AS time)
                                  + (CAST(:cleanupBufferMinutes AS integer) * INTERVAL '1 minute')
                        )
                        """, nativeQuery = true)
        boolean existsByCinemaRoomAndCleanupBufferConflict(
                        @Param("roomId") Long roomId,
                        @Param("showDate") LocalDate showDate,
                        @Param("startTime") LocalTime startTime,
                        @Param("endTime") LocalTime endTime,
                        @Param("cleanupBufferMinutes") Integer cleanupBufferMinutes);

        @Query("SELECT COUNT(s) > 0 FROM ShowTime s WHERE s.movie.movieId = :movieId " +
                        "AND (s.showDate > :currentDate OR (s.showDate = :currentDate AND s.startTime > :currentTime))")
        boolean existsByMovieMovieIdAndFutureShowTime(
                        @Param("movieId") Long movieId,
                        @Param("currentDate") LocalDate currentDate,
                        @Param("currentTime") LocalTime currentTime);

        /** MOV-LC-07: next bookable showtime for a movie at a specific cluster —
         *  "saleable" here means SCHEDULED or ON_SALE (not CANCELLED/COMPLETED/SUSPENDED). */
        @Query("SELECT s FROM ShowTime s WHERE s.movie.movieId = :movieId " +
                        "AND s.cinemaRoom.cluster.clusterId = :clusterId " +
                        "AND s.status IN (movieservice.enums.ShowTimeStatus.SCHEDULED, movieservice.enums.ShowTimeStatus.ON_SALE) " +
                        "AND (s.showDate > :currentDate OR (s.showDate = :currentDate AND s.startTime >= :currentTime)) " +
                        "ORDER BY s.showDate ASC, s.startTime ASC")
        List<ShowTime> findUpcomingSaleableByMovieAndCluster(
                        @Param("movieId") Long movieId,
                        @Param("clusterId") Long clusterId,
                        @Param("currentDate") LocalDate currentDate,
                        @Param("currentTime") LocalTime currentTime);

        /** MOV-03 release gate: same as existsByMovieMovieIdAndFutureShowTime but excludes CANCELLED. */
        @Query("SELECT COUNT(s) > 0 FROM ShowTime s WHERE s.movie.movieId = :movieId " +
                        "AND s.status <> movieservice.enums.ShowTimeStatus.CANCELLED " +
                        "AND (s.showDate > :currentDate OR (s.showDate = :currentDate AND s.startTime > :currentTime))")
        boolean existsByMovieMovieIdAndFutureNonCancelledShowTime(
                        @Param("movieId") Long movieId,
                        @Param("currentDate") LocalDate currentDate,
                        @Param("currentTime") LocalTime currentTime);

        @Query("SELECT COUNT(s) > 0 FROM ShowTime s WHERE s.showTimeId = :showTimeId " +
                        "AND (s.showDate > :currentDate OR (s.showDate = :currentDate AND s.startTime > :currentTime))")
        boolean existsByShowTimeIdAndFutureShowTime(
                        @Param("showTimeId") Long showTimeId,
                        @Param("currentDate") LocalDate currentDate,
                        @Param("currentTime") LocalTime currentTime);

        @Query("SELECT COUNT(s) > 0 FROM ShowTime s WHERE s.cinemaRoom.cinemaRoomId = :roomId " +
                        "AND s.showDate = :showDate " +
                        "AND s.status <> movieservice.enums.ShowTimeStatus.CANCELLED " +
                        "AND :startTime < s.endTime AND :endTime > s.startTime " +
                        "AND s.showTimeId <> :excludeId")
        boolean existsByCinemaRoomAndOverlappingTimeExcluding(
                        @Param("roomId") Long roomId,
                        @Param("showDate") LocalDate showDate,
                        @Param("startTime") LocalTime startTime,
                        @Param("endTime") LocalTime endTime,
                        @Param("excludeId") Long excludeId);

        boolean existsByCinemaRoomCinemaRoomId(Long roomId);

        /** Layout-activation guard (ROOM_LAYOUT_HAS_FUTURE_SHOWTIMES): blocks activating a new
         *  layout version while the room has upcoming scheduled/on-sale showtimes. */
        @Query("SELECT COUNT(s) > 0 FROM ShowTime s WHERE s.cinemaRoom.cinemaRoomId = :roomId " +
                        "AND s.status IN :statuses AND s.showDate >= :fromDate")
        boolean existsByCinemaRoomCinemaRoomIdAndStatusInAndShowDateGreaterThanEqual(
                        @Param("roomId") Long roomId,
                        @Param("statuses") List<movieservice.enums.ShowTimeStatus> statuses,
                        @Param("fromDate") LocalDate fromDate);

        List<ShowTime> findByMovieMovieId(Long movieId);

        List<ShowTime> findByMovieMovieIdAndShowDate(Long movieId, LocalDate showDate);

        /** One query for bulk preview/create; cancelled showtimes do not block a room. */
        @Query("SELECT s FROM ShowTime s " +
                        "WHERE s.cinemaRoom.cinemaRoomId IN :roomIds " +
                        "AND s.showDate BETWEEN :fromDate AND :toDate " +
                        "AND s.status <> movieservice.enums.ShowTimeStatus.CANCELLED " +
                        "ORDER BY s.cinemaRoom.cinemaRoomId, s.showDate, s.startTime")
        List<ShowTime> findActiveByRoomsAndDateRange(
                        @Param("roomIds") List<Long> roomIds,
                        @Param("fromDate") LocalDate fromDate,
                        @Param("toDate") LocalDate toDate);

        Page<ShowTime> findByGenerationRun_GenerationRunIdOrderByShowDateAscStartTimeAsc(
            Long generationRunId,
            Pageable pageable
        );

        /// Lấy toàn bộ showtime của run để tính thống kê created theo từng movie trong response.
        List<ShowTime> findAllByGenerationRun_GenerationRunIdOrderByShowDateAscStartTimeAsc(
            Long generationRunId
        );
}
