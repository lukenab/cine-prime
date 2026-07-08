package movieservice.repository;

import jakarta.transaction.Transactional;
import movieservice.entity.Movie;
import movieservice.enums.MovieStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MovieRepository extends JpaRepository<Movie, Long> {

    // ── Public-facing queries ─────────────────────────────────
    List<Movie> findByStatusIn(List<MovieStatus> statuses);

    List<Movie> findByStatus(MovieStatus status);

    // ── Admin / duplicate guard ───────────────────────────────
    boolean existsByOriginalTitleIgnoreCase(String originalTitle);

    boolean existsByTmdbId(Integer tmdbId);

    boolean existsByImdbId(String imdbId);

    // ── Status transitions (soft lifecycle) ───────────────────
    @Transactional
    @Modifying
    @Query("UPDATE Movie m SET m.status = :status, m.updatedBy = :updatedBy WHERE m.movieId = :movieId")
    int updateStatus(@Param("movieId") Long movieId,
                     @Param("status") MovieStatus status,
                     @Param("updatedBy") String updatedBy);

    @Transactional
    @Modifying
    @Query("UPDATE Movie m SET m.status = :#{T(movieservice.enums.MovieStatus).SUSPENDED}, " +
           "m.suspendedReason = :reason, m.updatedBy = :updatedBy WHERE m.movieId = :movieId")
    int suspendMovie(@Param("movieId") Long movieId,
                     @Param("reason") String reason,
                     @Param("updatedBy") String updatedBy);

    @Transactional
    @Modifying
    @Query("UPDATE Movie m SET m.status = :#{T(movieservice.enums.MovieStatus).REJECTED}, " +
           "m.rejectionNote = :note, m.updatedBy = :updatedBy WHERE m.movieId = :movieId")
    int rejectMovie(@Param("movieId") Long movieId,
                    @Param("note") String note,
                    @Param("updatedBy") String updatedBy);

    // ── Stats ─────────────────────────────────────────────────
    @Query("SELECT COUNT(m) FROM Movie m " +
           "WHERE EXTRACT(MONTH FROM m.createdAt) = :month " +
           "AND EXTRACT(YEAR FROM m.createdAt) = :year")
    long countByMonthAndYear(@Param("month") int month, @Param("year") int year);
}
