package movieservice.repository;

import movieservice.entity.MovieStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MovieStatusHistoryRepository extends JpaRepository<MovieStatusHistory, Long> {
    List<MovieStatusHistory> findByMovieIdOrderByCreatedAtDesc(Long movieId);
}
