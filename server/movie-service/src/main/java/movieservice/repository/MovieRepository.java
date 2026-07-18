package movieservice.repository;

import movieservice.entity.Movie;
import movieservice.enums.MovieStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface MovieRepository extends JpaRepository<Movie, Long> {

    // ── Public-facing queries ─────────────────────────────────
    List<Movie> findByStatusIn(List<MovieStatus> statuses);

    List<Movie> findByStatus(MovieStatus status);

    // ── Filtered paged query (admin / public) ─────────────────
    @Query("""
            SELECT DISTINCT m FROM Movie m
            LEFT JOIN m.genres g
            WHERE (:status IS NULL OR m.status = :status)
              AND (:genreId IS NULL OR g.genreId = :genreId)
              AND (:releaseDate IS NULL OR m.releaseDate = :releaseDate)
            """)
    Page<Movie> findWithFilters(
            @Param("status") MovieStatus status,
            @Param("genreId") Long genreId,
            @Param("releaseDate") LocalDate releaseDate,
            Pageable pageable);

    // ── Admin / duplicate guard ───────────────────────────────
    boolean existsByOriginalTitleIgnoreCase(String originalTitle);

    boolean existsByTmdbId(Integer tmdbId);

    boolean existsByImdbId(String imdbId);

    /** Dung boi TmdbService de danh dau alreadyImported trong browse/search list (bulk, tranh N+1) */
    @Query("SELECT m.tmdbId FROM Movie m WHERE m.tmdbId IN :tmdbIds")
    List<Integer> findExistingTmdbIds(@Param("tmdbIds") List<Integer> tmdbIds);

    // Lifecycle transitions go through MovieService's load → mutate → save()
    // instead of @Modifying bulk JPQL updates — bulk updates bypass @Version
    // increment entirely, which would silently defeat optimistic locking.

    // ── Stats ─────────────────────────────────────────────────
    @Query("SELECT COUNT(m) FROM Movie m " +
           "WHERE EXTRACT(MONTH FROM m.createdAt) = :month " +
           "AND EXTRACT(YEAR FROM m.createdAt) = :year")
    long countByMonthAndYear(@Param("month") int month, @Param("year") int year);
}
