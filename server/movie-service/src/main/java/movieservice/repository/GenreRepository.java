package movieservice.repository;

import movieservice.entity.Genre;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GenreRepository extends JpaRepository<Genre, Long> {
    Optional<Genre> findByGenreCode(String genreCode);
    boolean existsByGenreName(String genreName);
    List<Genre> findAllByGenreIdIn(List<Long> ids);
}
