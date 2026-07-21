package movieservice.repository;

import movieservice.entity.MovieAvailability;
import movieservice.enums.AvailabilityStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface MovieAvailabilityRepository extends JpaRepository<MovieAvailability, Long> {

    List<MovieAvailability> findByMovie_MovieId(Long movieId);

    List<MovieAvailability> findByCluster_ClusterId(Long clusterId);

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

    /** Nightly scheduler: OPEN/PLANNED/SUSPENDED windows whose showing_end_date has passed. */
    List<MovieAvailability> findByStatusInAndShowingEndDateBefore(List<AvailabilityStatus> statuses, LocalDate date);

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
}
