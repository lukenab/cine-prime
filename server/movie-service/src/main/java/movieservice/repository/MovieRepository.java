package movieservice.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.transaction.Transactional;
import movieservice.entity.Movie;

@Repository

public interface MovieRepository extends JpaRepository<Movie, Long> {
        List<Movie> findByStatusTrue();

        // Tự sinh query: DELETE FROM Movie WHERE createAt <= :time
        void deleteByCreateAtLessThanEqual(LocalDateTime time);

        // @Query("SELECT m FROM Movie m " +
        //                 "JOIN m.movieSchedules ms " +
        //                 "WHERE m.movieId = :movieId " +
        //                 "AND m.roomId = :roomId " +
        //                 "AND ms.showTime.showTimeId = :showTimeId")
        // Movie checkBookingValid(
        //                 @Param("movieId") Integer movieId,
        //                 @Param("roomId") Integer roomId,
        //                 @Param("showTimeId") Integer showTimeId);

        List<Movie> findByStatus(Boolean Status);

        @Query("SELECT COUNT(m) FROM Movie m " +
                        "WHERE EXTRACT(MONTH FROM m.createAt) = :month " +
                        "AND EXTRACT(YEAR FROM m.createAt) = :year")
        long countMoviesByMonthAndYear(@Param("month") int month, @Param("year") int year);

        List<Movie> findAllByMovieIdIn(List<Integer> ids);

        @Transactional
        @Modifying
        @Query("""
                            UPDATE Movie m
                            SET m.status = false
                            WHERE m.movieId = :movieId
                        """)
        int softDeleteMovie(@Param("movieId") Long movieId);

}
