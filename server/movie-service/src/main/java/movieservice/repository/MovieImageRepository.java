package movieservice.repository;

import movieservice.entity.MovieImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MovieImageRepository extends JpaRepository<MovieImage, Long> {
    List<MovieImage> findByMovie_MovieIdOrderByDisplayOrderAscImageIdAsc(Long movieId);
    void deleteByMovie_MovieId(Long movieId);
}
