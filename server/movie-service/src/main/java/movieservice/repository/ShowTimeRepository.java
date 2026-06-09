package movieservice.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import movieservice.dto.ShowTimeDTO;
import movieservice.entity.ShowTime;

public interface ShowTimeRepository extends JpaRepository<ShowTime, Integer> {
        @Query("SELECT s FROM ShowTime s WHERE s.roomId = :roomId AND s.movie.movieId = :movieId AND s.showTimeId = :showTimeId")
        ShowTime findShowTime(@Param("roomId") Long id, @Param("movieId") Long filmId,
                        @Param("showTimeId") Long timeId);

        @Query("SELECT s FROM ShowTime s " +
                        "WHERE s.roomId IN :roomIds " +
                        "AND s.movie.movieId IN :movieIds " + // Sửa chỗ này: Trỏ đúng vào s.movie.movieId theo Entity
                                                              // của bạn
                        "AND s.showTimeId IN :showTimeIds") // Chữ T viết hoa (s.showTimeId) cho khớp với
                                                            // st.getShowTimeId() trong Service
        List<ShowTime> findShowTimesByLists(
                        @Param("roomIds") List<Long> roomIds,
                        @Param("movieIds") List<Long> movieIds,
                        @Param("showTimeIds") List<Integer> showTimeIds);
                @Query("SELECT s FROM ShowTime s WHERE s.movie.movieId = :movieId")
        ShowTime findByMovieId(@Param("movieId") Integer movieId);
}
