package movieservice.repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.transaction.Transactional;
import movieservice.entity.ShowTime;

@Repository
public interface SheduleRepository extends JpaRepository<ShowTime, Integer> {
    @Query("""
                SELECT COUNT(s) > 0
                FROM ShowTime s
                WHERE
                    s.cinemaRoom.cinemaRoomId = :cinemaRoomId
                    AND s.showDate = :showDate
                    AND (
                        :startTime < s.endTime
                        AND :endTime > s.startTime
                    )
            """)
    boolean existsConflict(
            @Param("cinemaRoomId") Long cinemaRoomId,
            @Param("showDate") LocalDate showDate,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime);

    @Query("""
                SELECT COUNT(s) > 0
                FROM ShowTime s
                WHERE
                    s.cinemaRoom.cinemaRoomId = :cinemaRoomId
                    AND s.showDate = :showDate
                    AND s.id <> :scheduleId
                    AND (
                        :startTime < s.endTime
                        AND :endTime > s.startTime
                    )
            """)
    boolean existsConflicts(
            @Param("scheduleId") Long scheduleId,
            @Param("cinemaRoomId") Long cinemaRoomId,
            @Param("showDate") LocalDate showDate,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime);

    @Modifying
    @Query("DELETE FROM ShowTime st WHERE st.movie.movieId IN :movieIds")
    int deleteShowTimesByMovieIds(@Param("movieIds") List<Integer> movieIds);

    @Query("SELECT st.showTimeId FROM ShowTime st WHERE st.movie.movieId IN :movieIds")
    List<Long> findShowTimeIdsByMovieIds(@Param("movieIds") List<Integer> movieIds);

    @Transactional
    @Modifying
    @Query("UPDATE ShowTime st SET st.movie.movieId = :movieId WHERE st.showTimeId = :showTimeId")
    int updateMovieIdByShowTimeId(@Param("showTimeId") Long showTimeId, @Param("movieId") Integer movieId);

}
