package movieservice.service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.BulkCreateMovieAvailabilityRequest;
import movieservice.dto.request.CreateMovieAvailabilityRequest;
import movieservice.dto.request.UpdateMovieAvailabilityRequest;
import movieservice.dto.response.BulkCreateMovieAvailabilityResponse;
import movieservice.dto.response.MovieAvailabilityResponse;
import movieservice.entity.CinemaCluster;
import movieservice.entity.Movie;
import movieservice.entity.MovieAvailability;
import movieservice.entity.MovieAvailabilityHistory;
import movieservice.enums.AvailabilityStatus;
import movieservice.enums.ClusterStatus;
import movieservice.enums.MovieStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.lifecycle.LifecycleEventNotifier;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.MovieAvailabilityHistoryRepository;
import movieservice.repository.MovieAvailabilityRepository;
import movieservice.repository.MovieRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.time.LocalDateTime;

/**
 * Per-cluster exhibition/release-plan commands (MOV-LC-06). Independent from
 * MovieService — opening/suspending/closing an availability window never
 * touches Movie.status. See docs/api-specs/movie-service/MOVIE_LIFECYCLE_CONTRACT.md.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieAvailabilityService {

    MovieAvailabilityRepository movieAvailabilityRepository;
    MovieAvailabilityHistoryRepository movieAvailabilityHistoryRepository;
    MovieRepository movieRepository;
    CinemaClusterRepository cinemaClusterRepository;
    MovieMapper movieMapper;
    LifecycleEventNotifier lifecycleEventNotifier;

    @Transactional
    public MovieAvailabilityResponse create(CreateMovieAvailabilityRequest request, String actor) {
        Movie movie = movieRepository.findById(request.getMovieId())
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
        if (movie.getStatus() != MovieStatus.APPROVED) {
            throw new AppException(MovieErrorCode.AVAILABILITY_MOVIE_NOT_APPROVED);
        }

        CinemaCluster cluster = cinemaClusterRepository.findById(request.getClusterId())
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));
        if (cluster.getStatus() != ClusterStatus.ACTIVE) {
            throw new AppException(MovieErrorCode.AVAILABILITY_CLUSTER_NOT_ACTIVE);
        }

        validateDateRange(request.getShowingStartDate(), request.getShowingEndDate());
        validateSalesStart(request.getSalesStartAt(), request.getShowingStartDate());

        MovieAvailability availability = MovieAvailability.builder()
                .movie(movie)
                .cluster(cluster)
                .status(AvailabilityStatus.PLANNED)
                .salesStartAt(request.getSalesStartAt())
                .showingStartDate(request.getShowingStartDate())
                .showingEndDate(request.getShowingEndDate())
                .createdBy(actor)
                .updatedBy(actor)
                .build();

        try {
            MovieAvailability saved = movieAvailabilityRepository.save(availability);
            recordHistory(saved.getAvailabilityId(), null, AvailabilityStatus.PLANNED, actor, null);
            notifyChange(saved, "CREATED");
            return movieMapper.toMovieAvailabilityResponse(saved);
        } catch (DataIntegrityViolationException e) {
            throw new AppException(MovieErrorCode.AVAILABILITY_WINDOW_ALREADY_EXISTS);
        }
    }

    /** "Wide release" — create a PLANNED window for many clusters in one call (MOV-LC-06 bulk
     *  variant). Best-effort per cluster rather than all-or-nothing: a cluster that isn't
     *  ACTIVE, or already has a window for this movie/date, is skipped with a reason instead of
     *  aborting the whole batch — the caller (an admin releasing wide) cares about "which
     *  clusters actually got provisioned", not a single failure blocking every other cluster. */
    @Transactional
    public BulkCreateMovieAvailabilityResponse bulkCreate(BulkCreateMovieAvailabilityRequest request, String actor) {
        Movie movie = movieRepository.findById(request.getMovieId())
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
        if (movie.getStatus() != MovieStatus.APPROVED) {
            throw new AppException(MovieErrorCode.AVAILABILITY_MOVIE_NOT_APPROVED);
        }
        validateDateRange(request.getShowingStartDate(), request.getShowingEndDate());
        validateSalesStart(request.getSalesStartAt(), request.getShowingStartDate());

        List<CinemaCluster> targetClusters = Boolean.TRUE.equals(request.getAllActiveClusters())
                ? cinemaClusterRepository.findByStatus(ClusterStatus.ACTIVE)
                : cinemaClusterRepository.findAllById(
                        request.getClusterIds() == null ? List.of() : request.getClusterIds());
        if (targetClusters.isEmpty()) {
            throw new AppException(MovieErrorCode.CLUSTER_NOT_FOUND);
        }

        List<Long> clusterIds = targetClusters.stream().map(CinemaCluster::getClusterId).toList();
        List<Long> alreadyPlanned = movieAvailabilityRepository.findClusterIdsWithExistingWindow(
                movie.getMovieId(), request.getShowingStartDate(), clusterIds);

        List<BulkCreateMovieAvailabilityResponse.SkippedCluster> skipped = new ArrayList<>();
        List<MovieAvailability> toInsert = new ArrayList<>();
        for (CinemaCluster cluster : targetClusters) {
            if (cluster.getStatus() != ClusterStatus.ACTIVE) {
                skipped.add(skip(cluster, "Cluster is not ACTIVE"));
            } else if (alreadyPlanned.contains(cluster.getClusterId())) {
                skipped.add(skip(cluster, "A release plan for this movie/cluster/date already exists"));
            } else {
                toInsert.add(MovieAvailability.builder()
                        .movie(movie)
                        .cluster(cluster)
                        .status(AvailabilityStatus.PLANNED)
                        .salesStartAt(request.getSalesStartAt())
                        .showingStartDate(request.getShowingStartDate())
                        .showingEndDate(request.getShowingEndDate())
                        .createdBy(actor)
                        .updatedBy(actor)
                        .build());
            }
        }

        List<MovieAvailability> saved;
        try {
            saved = movieAvailabilityRepository.saveAll(toInsert);
        } catch (DataIntegrityViolationException e) {
            // Only reachable via a genuine race after the pre-check above (another request
            // planned the same movie/cluster/date in between) - rare enough that failing the
            // whole batch and asking the admin to retry is an acceptable trade-off against the
            // complexity of per-cluster transactions.
            throw new AppException(MovieErrorCode.AVAILABILITY_WINDOW_ALREADY_EXISTS);
        }
        for (MovieAvailability availability : saved) {
            recordHistory(availability.getAvailabilityId(), null, AvailabilityStatus.PLANNED, actor, null);
            notifyChange(availability, "CREATED");
        }

        return BulkCreateMovieAvailabilityResponse.builder()
                .created(movieMapper.toMovieAvailabilityResponseList(saved))
                .skipped(skipped)
                .build();
    }

    private BulkCreateMovieAvailabilityResponse.SkippedCluster skip(CinemaCluster cluster, String reason) {
        return BulkCreateMovieAvailabilityResponse.SkippedCluster.builder()
                .clusterId(cluster.getClusterId())
                .clusterName(cluster.getClusterName())
                .reason(reason)
                .build();
    }

    @Transactional
    public MovieAvailabilityResponse update(Long id, UpdateMovieAvailabilityRequest request, String actor) {
        MovieAvailability availability = findOrThrow(id);
        if (availability.getStatus() != AvailabilityStatus.PLANNED
                && availability.getStatus() != AvailabilityStatus.CHANGES_REQUESTED) {
            throw new AppException(MovieErrorCode.AVAILABILITY_NOT_EDITABLE);
        }

        if (request.getSalesStartAt() != null) availability.setSalesStartAt(request.getSalesStartAt());
        if (request.getShowingStartDate() != null) availability.setShowingStartDate(request.getShowingStartDate());
        if (request.getShowingEndDate() != null) availability.setShowingEndDate(request.getShowingEndDate());
        validateDateRange(availability.getShowingStartDate(), availability.getShowingEndDate());
        validateSalesStart(availability.getSalesStartAt(), availability.getShowingStartDate());
        availability.setUpdatedBy(actor);

        MovieAvailability saved = movieAvailabilityRepository.save(availability);
        notifyChange(saved, "UPDATED");
        return movieMapper.toMovieAvailabilityResponse(saved);
    }

    /** PLANNED → OPEN */
    @Transactional
    public MovieAvailabilityResponse submitReview(Long id, String actor, String note) {
        MovieAvailability availability = findOrThrow(id);
        if (availability.getStatus() != AvailabilityStatus.PLANNED
                && availability.getStatus() != AvailabilityStatus.CHANGES_REQUESTED) {
            throw new AppException(MovieErrorCode.AVAILABILITY_INVALID_TRANSITION);
        }
        availability.setSubmittedAt(LocalDateTime.now());
        availability.setSubmittedBy(actor);
        availability.setReviewNote(note);
        return transitionTo(availability, AvailabilityStatus.IN_REVIEW, actor, note);
    }

    @Transactional
    public MovieAvailabilityResponse requestChanges(Long id, String actor, String note) {
        if (note == null || note.isBlank()) {
            throw new AppException(MovieErrorCode.AVAILABILITY_REVIEW_NOTE_REQUIRED);
        }
        MovieAvailability availability = requireStatus(
                id, AvailabilityStatus.IN_REVIEW, MovieErrorCode.AVAILABILITY_INVALID_TRANSITION);
        availability.setReviewNote(note.trim());
        return transitionTo(availability, AvailabilityStatus.CHANGES_REQUESTED, actor, note.trim());
    }

    @Transactional
    public MovieAvailabilityResponse approve(Long id, String actor, String note) {
        MovieAvailability availability = requireStatus(
                id, AvailabilityStatus.IN_REVIEW, MovieErrorCode.AVAILABILITY_INVALID_TRANSITION);
        if (sameActor(availability.getCreatedBy(), actor)
                || sameActor(availability.getSubmittedBy(), actor)) {
            throw new AppException(MovieErrorCode.AVAILABILITY_SELF_APPROVAL_FORBIDDEN);
        }
        availability.setApprovedAt(LocalDateTime.now());
        availability.setApprovedBy(actor);
        availability.setReviewNote(note);
        return transitionTo(availability, AvailabilityStatus.APPROVED, actor, note);
    }

    @Transactional
    public MovieAvailabilityResponse open(Long id, String actor) {
        MovieAvailability availability = requireStatus(id, AvailabilityStatus.APPROVED, MovieErrorCode.AVAILABILITY_INVALID_TRANSITION);
        return transitionTo(availability, AvailabilityStatus.OPEN, actor, null);
    }

    /** PLANNED/OPEN → SUSPENDED, reason mandatory */
    @Transactional
    public MovieAvailabilityResponse suspend(Long id, String reason, String actor) {
        MovieAvailability availability = findOrThrow(id);
        if (availability.getStatus() != AvailabilityStatus.OPEN) {
            throw new AppException(MovieErrorCode.AVAILABILITY_INVALID_TRANSITION);
        }
        availability.setSuspensionReason(reason);
        return transitionTo(availability, AvailabilityStatus.SUSPENDED, actor, reason);
    }

    /** SUSPENDED → OPEN */
    @Transactional
    public MovieAvailabilityResponse resume(Long id, String actor) {
        MovieAvailability availability = requireStatus(id, AvailabilityStatus.SUSPENDED, MovieErrorCode.AVAILABILITY_INVALID_TRANSITION);
        availability.setSuspensionReason(null);
        return transitionTo(availability, AvailabilityStatus.OPEN, actor, null);
    }

    /** PLANNED/OPEN/SUSPENDED → CLOSED. Reason is optional - unlike suspend, closing needs no
     *  justification, but capturing one (e.g. "cancelled before playing" vs "run completed")
     *  lets reporting later tell the two apart in movie_availability_history. */
    @Transactional
    public MovieAvailabilityResponse close(Long id, String reason, String actor) {
        MovieAvailability availability = findOrThrow(id);
        if (availability.getStatus() == AvailabilityStatus.CLOSED) {
            throw new AppException(MovieErrorCode.AVAILABILITY_INVALID_TRANSITION);
        }
        return transitionTo(availability, AvailabilityStatus.CLOSED, actor, reason);
    }

    public List<MovieAvailabilityResponse> search(Long movieId, Long clusterId, AvailabilityStatus status) {
        return movieMapper.toMovieAvailabilityResponseList(
                movieAvailabilityRepository.search(movieId, clusterId, status));
    }

    private MovieAvailability findOrThrow(Long id) {
        return movieAvailabilityRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.AVAILABILITY_NOT_FOUND));
    }

    private MovieAvailability requireStatus(Long id, AvailabilityStatus required, MovieErrorCode onMismatch) {
        MovieAvailability availability = findOrThrow(id);
        if (availability.getStatus() != required) {
            throw new AppException(onMismatch);
        }
        return availability;
    }

    private MovieAvailabilityResponse transitionTo(MovieAvailability availability, AvailabilityStatus to, String actor, String reason) {
        AvailabilityStatus from = availability.getStatus();
        availability.setStatus(to);
        availability.setUpdatedBy(actor);
        MovieAvailability saved = movieAvailabilityRepository.save(availability);
        recordHistory(saved.getAvailabilityId(), from, to, actor, reason);
        notifyChange(saved, "STATUS_CHANGED");
        return movieMapper.toMovieAvailabilityResponse(saved);
    }

    private void recordHistory(Long availabilityId, AvailabilityStatus from, AvailabilityStatus to, String actor, String reason) {
        movieAvailabilityHistoryRepository.save(MovieAvailabilityHistory.builder()
                .availabilityId(availabilityId)
                .fromStatus(from)
                .toStatus(to)
                .actor(actor)
                .reason(reason)
                .build());
    }

    private void validateDateRange(java.time.LocalDate start, java.time.LocalDate end) {
        if (start != null && end != null && end.isBefore(start)) {
            throw new AppException(MovieErrorCode.AVAILABILITY_DATE_RANGE_INVALID);
        }
    }

    private void validateSalesStart(LocalDateTime salesStartAt, java.time.LocalDate showingStartDate) {
        if (salesStartAt != null && showingStartDate != null
                && salesStartAt.toLocalDate().isAfter(showingStartDate)) {
            throw new AppException(MovieErrorCode.AVAILABILITY_SALES_START_INVALID);
        }
    }

    private boolean sameActor(String first, String second) {
        return first != null && second != null && first.equalsIgnoreCase(second);
    }

    private void notifyChange(MovieAvailability availability, String action) {
        lifecycleEventNotifier.notifyChange(
                "RELEASE_PLAN",
                availability.getAvailabilityId(),
                availability.getStatus().name(),
                action,
                availability.getMovie().getMovieId(),
                availability.getCluster().getClusterId());
    }
}
