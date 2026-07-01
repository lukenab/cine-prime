package movieservice.repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import movieservice.entity.ShowTime;

public interface ShowTimeRepository extends JpaRepository<ShowTime, Long> {

        @Query("SELECT COUNT(s) > 0 FROM ShowTime s WHERE s.cinemaRoom.id = :roomId " +
                        "AND s.showDate = :showDate " +
                        "AND :startTime < s.endTime AND :endTime > s.startTime")
        boolean existsByCinemaRoomAndOverlappingTime(
                        @Param("roomId") Long roomId,
                        @Param("showDate") LocalDate showDate,
                        @Param("startTime") LocalTime startTime,
                        @Param("endTime") LocalTime endTime);

        @Query("SELECT COUNT(s) > 0 FROM ShowTime s WHERE s.movie.movieId = :movieId " +
                        "AND (s.showDate > :currentDate OR (s.showDate = :currentDate AND s.startTime > :currentTime))")
        boolean existsByMovieMovieIdAndFutureShowTime(
                        @Param("movieId") Long movieId,
                        @Param("currentDate") LocalDate currentDate,
                        @Param("currentTime") LocalTime currentTime);

        @Query("SELECT COUNT(s) > 0 FROM ShowTime s WHERE s.showTimeId = :showTimeId " +
                        "AND (s.showDate > :currentDate OR (s.showDate = :currentDate AND s.startTime > :currentTime))")
        boolean existsByShowTimeIdAndFutureShowTime(
                        @Param("showTimeId") Long showTimeId,
                        @Param("currentDate") LocalDate currentDate,
                        @Param("currentTime") LocalTime currentTime);

        @Query("SELECT COUNT(s) > 0 FROM ShowTime s WHERE s.cinemaRoom.id = :roomId " +
                        "AND s.showDate = :showDate " +
                        "AND :startTime < s.endTime AND :endTime > s.startTime " +
                        "AND s.showTimeId <> :excludeId")
        boolean existsByCinemaRoomAndOverlappingTimeExcluding(
                        @Param("roomId") Long roomId,
                        @Param("showDate") LocalDate showDate,
                        @Param("startTime") LocalTime startTime,
                        @Param("endTime") LocalTime endTime,
                        @Param("excludeId") Long excludeId);

        List<ShowTime> findByMovieMovieId(Long movieId);

        List<ShowTime> findByMovieMovieIdAndShowDate(Long movieId, LocalDate showDate);
}
