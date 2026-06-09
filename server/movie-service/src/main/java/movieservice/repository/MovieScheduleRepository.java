package movieservice.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.transaction.Transactional;
import movieservice.entity.Movie;
import movieservice.entity.MovieSchedule;
import movieservice.entity.MovieScheduleConnect;

@Repository
public interface MovieScheduleRepository extends JpaRepository<MovieSchedule, MovieScheduleConnect> {
    
    // Câu truy vấn xóa dọn dẹp dựa vào danh sách ID phim
    @Modifying
    @Query("DELETE FROM MovieSchedule ms WHERE ms.id.movieId IN :movieIds")
    int deleteByMovieIds(@Param("movieIds") List<Integer> movieIds);

    @Modifying
    @Transactional
    @Query("DELETE FROM MovieSchedule ms WHERE ms.movie = :movie")
    void deleteByMovie(Movie movie);
}