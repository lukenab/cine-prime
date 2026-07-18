package movieservice.repository;

import movieservice.entity.MovieImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Set;

@Repository
public interface MovieImageRepository extends JpaRepository<MovieImage, Long> {
    List<MovieImage> findByMovie_MovieIdOrderByDisplayOrderAscImageIdAsc(Long movieId);
    void deleteByMovie_MovieId(Long movieId);

    /** Existing (source, external_path) pairs for a movie - used to skip already-imported TMDB assets before insert. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT CONCAT(i.source, ':', i.externalPath) FROM MovieImage i "
                    + "WHERE i.movie.movieId = :movieId AND i.source IS NOT NULL AND i.externalPath IS NOT NULL")
    Set<String> findExistingSourcePathKeys(Long movieId);
}
