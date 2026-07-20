package movieservice.service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.CreateMovieAvailabilityRequest;
import movieservice.dto.request.UpdateMovieAvailabilityRequest;
import movieservice.dto.response.MovieAvailabilityResponse;
import movieservice.entity.CinemaCluster;
import movieservice.entity.Movie;
import movieservice.entity.MovieAvailability;
import movieservice.entity.MovieAvailabilityHistory;
import movieservice.enums.AvailabilityStatus;
import movieservice.enums.ClusterStatus;
import movieservice.enums.MovieStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.MovieAvailabilityHistoryRepository;
import movieservice.repository.MovieAvailabilityRepository;
import movieservice.repository.MovieRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.List;

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
            return movieMapper.toMovieAvailabilityResponse(saved);
        } catch (DataIntegrityViolationException e) {
            throw new AppException(MovieErrorCode.AVAILABILITY_WINDOW_ALREADY_EXISTS);
        }
    }

    @Transactional
    public MovieAvailabilityResponse update(Long id, UpdateMovieAvailabilityRequest request, String actor) {
        MovieAvailability availability = requireStatus(id, AvailabilityStatus.PLANNED, MovieErrorCode.AVAILABILITY_NOT_EDITABLE);

        if (request.getSalesStartAt() != null) availability.setSalesStartAt(request.getSalesStartAt());
        if (request.getShowingStartDate() != null) availability.setShowingStartDate(request.getShowingStartDate());
        if (request.getShowingEndDate() != null) availability.setShowingEndDate(request.getShowingEndDate());
        validateDateRange(availability.getShowingStartDate(), availability.getShowingEndDate());
        availability.setUpdatedBy(actor);

        return movieMapper.toMovieAvailabilityResponse(movieAvailabilityRepository.save(availability));
    }

    /** PLANNED → OPEN */
    @Transactional
    public MovieAvailabilityResponse open(Long id, String actor) {
        MovieAvailability availability = requireStatus(id, AvailabilityStatus.PLANNED, MovieErrorCode.AVAILABILITY_INVALID_TRANSITION);
        return transitionTo(availability, AvailabilityStatus.OPEN, actor, null);
    }

    /** PLANNED/OPEN → SUSPENDED, reason mandatory */
    @Transactional
    public MovieAvailabilityResponse suspend(Long id, String reason, String actor) {
        MovieAvailability availability = findOrThrow(id);
        if (availability.getStatus() != AvailabilityStatus.PLANNED && availability.getStatus() != AvailabilityStatus.OPEN) {
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

    /** PLANNED/OPEN/SUSPENDED → CLOSED */
    @Transactional
    public MovieAvailabilityResponse close(Long id, String actor) {
        MovieAvailability availability = findOrThrow(id);
        if (availability.getStatus() == AvailabilityStatus.CLOSED) {
            throw new AppException(MovieErrorCode.AVAILABILITY_INVALID_TRANSITION);
        }
        return transitionTo(availability, AvailabilityStatus.CLOSED, actor, null);
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
}
