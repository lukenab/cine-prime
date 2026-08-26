package movieservice.repository;

import movieservice.entity.MovieAvailability;
import movieservice.enums.AvailabilityStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MovieAvailabilityRepository extends JpaRepository<MovieAvailability, Long> {

    List<MovieAvailability> findByMovie_MovieId(Long movieId);

    List<MovieAvailability> findByCluster_ClusterId(Long clusterId);

    @Query("""
            SELECT availability FROM MovieAvailability availability
            JOIN FETCH availability.movie
            JOIN FETCH availability.cluster
            WHERE availability.movie.movieId IN :movieIds
            ORDER BY availability.movie.movieId, availability.cluster.clusterName,
                     availability.showingStartDate DESC
            """)
    List<MovieAvailability> findQueuePlansByMovieIds(@Param("movieIds") List<Long> movieIds);

    boolean existsByCluster_ClusterId(Long clusterId);

    @Query("""
            SELECT a FROM MovieAvailability a
            WHERE (:movieId IS NULL OR a.movie.movieId = :movieId)
              AND (:clusterId IS NULL OR a.cluster.clusterId = :clusterId)
              AND (:status IS NULL OR a.status = :status)
            ORDER BY a.showingStartDate DESC
            """)
    List<MovieAvailability> search(
            @Param("movieId") Long movieId,
            @Param("clusterId") Long clusterId,
            @Param("status") AvailabilityStatus status);

    boolean existsByMovie_MovieIdAndStatusIn(Long movieId, List<AvailabilityStatus> statuses);

    @Query("""
            SELECT COUNT(DISTINCT availability.movie.movieId)
            FROM MovieAvailability availability
            WHERE availability.movie.status = movieservice.enums.MovieStatus.APPROVED
              AND availability.status IN :statuses
            """)
    long countDistinctApprovedMoviesByStatuses(@Param("statuses") List<AvailabilityStatus> statuses);

    /** Nightly scheduler: OPEN/PLANNED/SUSPENDED windows whose showing_end_date has passed. */
    List<MovieAvailability> findByStatusInAndShowingEndDateBefore(List<AvailabilityStatus> statuses, LocalDate date);

    /** Scheduler: only an approved release plan may automatically open for ticket sales. */
    @Query("""
            SELECT availability FROM MovieAvailability availability
            WHERE availability.status = movieservice.enums.AvailabilityStatus.APPROVED
              AND availability.salesStartAt IS NOT NULL
              AND availability.salesStartAt <= :businessDateTime
              AND availability.showingStartDate >= :businessDate
              AND (
                    availability.showingEndDate IS NULL
                    OR availability.showingEndDate >= :businessDate
              )
            """)
    List<MovieAvailability> findDueToOpen(
            @Param("businessDateTime") LocalDateTime businessDateTime,
            @Param("businessDate") LocalDate businessDate);

    /** Bulk create: pre-check which of the candidate clusters already have a window for this
     *  movie/date, so the batch insert skips them cleanly instead of tripping the unique
     *  constraint mid-batch (which would poison the whole @Transactional call). */
    @Query("""
            SELECT a.cluster.clusterId FROM MovieAvailability a
            WHERE a.movie.movieId = :movieId
              AND a.showingStartDate = :showingStartDate
              AND a.cluster.clusterId IN :clusterIds
            """)
    List<Long> findClusterIdsWithExistingWindow(
            @Param("movieId") Long movieId,
            @Param("showingStartDate") LocalDate showingStartDate,
            @Param("clusterIds") List<Long> clusterIds);

    @Query("""
        SELECT COUNT(availability) > 0
        FROM MovieAvailability availability
        WHERE availability.movie.movieId = :movieId
          AND availability.cluster.clusterId = :clusterId
          AND availability.movie.status = movieservice.enums.MovieStatus.APPROVED
          AND availability.status IN (
                movieservice.enums.AvailabilityStatus.APPROVED,
                movieservice.enums.AvailabilityStatus.OPEN
          )
          AND availability.showingStartDate <= :showDate
          AND (
                availability.showingEndDate IS NULL
                OR availability.showingEndDate >= :showDate
          )
        """)
    boolean existsSchedulableForDate(
            @Param("movieId") Long movieId,
            @Param("clusterId") Long clusterId,
            @Param("showDate") LocalDate showDate
    );
}
