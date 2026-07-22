package movieservice.repository;

import movieservice.entity.MovieScreeningVersion;
import movieservice.enums.ScreeningVersionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface MovieScreeningVersionRepository extends JpaRepository<MovieScreeningVersion, Long> {

    @Query("""
            SELECT version
            FROM MovieScreeningVersion version
            JOIN FETCH version.format
            WHERE version.movie.movieId = :movieId
              AND version.status = :status
              AND (version.effectiveFrom IS NULL OR version.effectiveFrom <= :businessDate)
              AND (version.effectiveTo IS NULL OR version.effectiveTo >= :businessDate)
            ORDER BY version.screeningVersionId
            """)
    List<MovieScreeningVersion> findEffectiveVersions(
            @Param("movieId") Long movieId,
            @Param("businessDate") LocalDate businessDate,
            @Param("status") ScreeningVersionStatus status
    );
}

