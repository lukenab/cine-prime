package movieservice.repository;

import movieservice.entity.MovieCast;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MovieCastRepository extends JpaRepository<MovieCast, Long> {
    List<MovieCast> findByMovie_MovieId(Long movieId);
    void deleteByMovie_MovieId(Long movieId);
}
