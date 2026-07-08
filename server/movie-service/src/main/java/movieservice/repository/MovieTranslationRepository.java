package movieservice.repository;

import movieservice.entity.MovieTranslation;
import movieservice.entity.MovieTranslationId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MovieTranslationRepository extends JpaRepository<MovieTranslation, MovieTranslationId> {
    List<MovieTranslation> findById_MovieId(Long movieId);
    void deleteById_MovieId(Long movieId);
}
