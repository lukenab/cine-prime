package movieservice.repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import movieservice.entity.ShowTime;

public interface ShowTimeRepository extends JpaRepository<ShowTime, Long> {
        @Query("SELECT s FROM ShowTime s WHERE s.cinemaRoom.cinemaRoomId = :roomId AND s.movie.movieId = :movieId AND s.showTimeId = :showTimeId")
        ShowTime findShowTime(@Param("roomId") Long id, @Param("movieId") Long filmId,
                        @Param("showTimeId") Long timeId);

        @Query("SELECT s FROM ShowTime s " +
                        "WHERE s.cinemaRoom.cinemaRoomId IN :cinemaRoomId " +
                        "AND s.movie.movieId IN :movieIds " + // Sửa chỗ này: Trỏ đúng vào s.movie.movieId theo Entity
                                                              // của bạn
                        "AND s.showTimeId IN :showTimeIds") // Chữ T viết hoa (s.showTimeId) cho khớp với
                                                            // st.getShowTimeId() trong Service
        List<ShowTime> findShowTimesByLists(
                        @Param("cinemaRoomId") List<Long> cinemaRoomId,
                        @Param("movieIds") List<Long> movieIds,
                        @Param("showTimeIds") List<Integer> showTimeIds);

        @Query("SELECT s FROM ShowTime s WHERE s.movie.movieId = :movieId")
        ShowTime findByMovieId(@Param("movieId") Integer movieId);

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
                        @Param("movieId") Integer movieId,
                        @Param("currentDate") LocalDate currentDate,
                        @Param("currentTime") LocalTime currentTime);
}
