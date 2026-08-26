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
    @Query(value = """
            SELECT DISTINCT m FROM Movie m
            LEFT JOIN m.genres g
            LEFT JOIN m.translations t
            WHERE (:status IS NULL OR m.status = :status)
              AND (:genreId IS NULL OR g.genreId = :genreId)
              AND (CAST(:releaseDate AS date) IS NULL OR m.releaseDate = :releaseDate)
              AND (CAST(:qPattern AS string) IS NULL
                   OR LOWER(m.originalTitle) LIKE :qPattern
                   OR LOWER(t.title) LIKE :qPattern)
            """, countQuery = """
            SELECT COUNT(DISTINCT m.movieId) FROM Movie m
            LEFT JOIN m.genres g
            LEFT JOIN m.translations t
            WHERE (:status IS NULL OR m.status = :status)
              AND (:genreId IS NULL OR g.genreId = :genreId)
              AND (CAST(:releaseDate AS date) IS NULL OR m.releaseDate = :releaseDate)
              AND (CAST(:qPattern AS string) IS NULL
                   OR LOWER(m.originalTitle) LIKE :qPattern
                   OR LOWER(t.title) LIKE :qPattern)
            """)
    Page<Movie> findWithFilters(
            @Param("status") MovieStatus status,
            @Param("genreId") Long genreId,
            @Param("releaseDate") LocalDate releaseDate,
            @Param("qPattern") String qPattern,
            Pageable pageable);

    @Query(value = """
            SELECT movie.movie_id
            FROM movie movie
            LEFT JOIN movie_translation title_vi
              ON title_vi.movie_id = movie.movie_id AND title_vi.language_code = 'vi'
            LEFT JOIN movie_translation title_en
              ON title_en.movie_id = movie.movie_id AND title_en.language_code = 'en'
            WHERE movie.status = 'APPROVED'
              AND (:query IS NULL
                   OR LOWER(movie.original_title) LIKE LOWER(CONCAT('%', CAST(:query AS text), '%'))
                   OR LOWER(COALESCE(title_vi.title, '')) LIKE LOWER(CONCAT('%', CAST(:query AS text), '%'))
                   OR LOWER(COALESCE(title_en.title, '')) LIKE LOWER(CONCAT('%', CAST(:query AS text), '%')))
            ORDER BY COALESCE(title_vi.title, title_en.title, movie.original_title), movie.movie_id
            """, countQuery = """
            SELECT COUNT(*)
            FROM movie movie
            LEFT JOIN movie_translation title_vi
              ON title_vi.movie_id = movie.movie_id AND title_vi.language_code = 'vi'
            LEFT JOIN movie_translation title_en
              ON title_en.movie_id = movie.movie_id AND title_en.language_code = 'en'
            WHERE movie.status = 'APPROVED'
              AND (:query IS NULL
                   OR LOWER(movie.original_title) LIKE LOWER(CONCAT('%', CAST(:query AS text), '%'))
                   OR LOWER(COALESCE(title_vi.title, '')) LIKE LOWER(CONCAT('%', CAST(:query AS text), '%'))
                   OR LOWER(COALESCE(title_en.title, '')) LIKE LOWER(CONCAT('%', CAST(:query AS text), '%')))
            """, nativeQuery = true)
    Page<Long> findApprovedMovieIdsForReleaseQueue(
            @Param("query") String query,
            Pageable pageable);

    @Query("""
            SELECT DISTINCT movie FROM Movie movie
            LEFT JOIN FETCH movie.translations
            WHERE movie.movieId IN :movieIds
            """)
    List<Movie> findByMovieIdInWithTranslations(@Param("movieIds") List<Long> movieIds);

    @Query("""
            SELECT COUNT(movie) FROM Movie movie
            WHERE movie.status = movieservice.enums.MovieStatus.APPROVED
              AND NOT EXISTS (
                  SELECT availability.availabilityId FROM MovieAvailability availability
                  WHERE availability.movie = movie
              )
            """)
    long countApprovedMoviesWithoutReleasePlan();

    // ── Admin / duplicate guard ───────────────────────────────
    boolean existsByOriginalTitleIgnoreCase(String originalTitle);

    boolean existsByTmdbId(Integer tmdbId);

    boolean existsByImdbId(String imdbId);

    /**
     * Dung boi TmdbService de danh dau alreadyImported (va localMovieId cho View/Sync action)
     * trong browse/search list - bulk, tranh N+1 goi existsByTmdbId() tung item mot.
     */
    @Query("SELECT m.tmdbId AS tmdbId, m.movieId AS movieId FROM Movie m WHERE m.tmdbId IN :tmdbIds")
    List<TmdbIdAndMovieId> findExistingTmdbIdsWithMovieId(@Param("tmdbIds") List<Integer> tmdbIds);

    interface TmdbIdAndMovieId {
        Integer getTmdbId();
        Long getMovieId();
    }

    // Lifecycle transitions go through MovieService's load → mutate → save()
    // instead of @Modifying bulk JPQL updates — bulk updates bypass @Version
    // increment entirely, which would silently defeat optimistic locking.

    // ── Stats ─────────────────────────────────────────────────
    @Query("SELECT COUNT(m) FROM Movie m " +
           "WHERE EXTRACT(MONTH FROM m.createdAt) = :month " +
           "AND EXTRACT(YEAR FROM m.createdAt) = :year")
    long countByMonthAndYear(@Param("month") int month, @Param("year") int year);
}
