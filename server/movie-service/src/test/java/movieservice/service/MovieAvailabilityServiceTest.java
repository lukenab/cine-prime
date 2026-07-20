package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.CreateMovieAvailabilityRequest;
import movieservice.dto.response.MovieAvailabilityResponse;
import movieservice.entity.CinemaCluster;
import movieservice.entity.Movie;
import movieservice.entity.MovieAvailability;
import movieservice.enums.AvailabilityStatus;
import movieservice.enums.ClusterStatus;
import movieservice.enums.MovieStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.MovieAvailabilityHistoryRepository;
import movieservice.repository.MovieAvailabilityRepository;
import movieservice.repository.MovieRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MovieAvailabilityServiceTest {

    @Mock MovieAvailabilityRepository movieAvailabilityRepository;
    @Mock MovieAvailabilityHistoryRepository movieAvailabilityHistoryRepository;
    @Mock MovieRepository movieRepository;
    @Mock CinemaClusterRepository cinemaClusterRepository;
    @Mock MovieMapper movieMapper;

    private MovieAvailabilityService service;
    private Movie approvedMovie;
    private CinemaCluster activeCluster;

    @BeforeEach
    void setUp() {
        service = new MovieAvailabilityService(
                movieAvailabilityRepository, movieAvailabilityHistoryRepository,
                movieRepository, cinemaClusterRepository, movieMapper);

        approvedMovie = Movie.builder().movieId(1L).status(MovieStatus.APPROVED).build();
        activeCluster = CinemaCluster.builder().clusterId(1L).status(ClusterStatus.ACTIVE).build();

        lenient().when(movieAvailabilityRepository.save(any(MovieAvailability.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        lenient().when(movieMapper.toMovieAvailabilityResponse(any())).thenReturn(new MovieAvailabilityResponse());
    }

    private CreateMovieAvailabilityRequest createRequest(LocalDate start, LocalDate end) {
        return CreateMovieAvailabilityRequest.builder()
                .movieId(1L)
                .clusterId(1L)
                .showingStartDate(start)
                .showingEndDate(end)
                .build();
    }

    // ── create ────────────────────────────────────────────────────────────

    @Test
    void createRejectsWhenMovieNotApproved() {
        approvedMovie.setStatus(MovieStatus.DRAFT);
        when(movieRepository.findById(1L)).thenReturn(Optional.of(approvedMovie));

        AppException ex = assertThrows(AppException.class,
                () -> service.create(createRequest(LocalDate.now(), null), "admin"));

        assertEquals(MovieErrorCode.AVAILABILITY_MOVIE_NOT_APPROVED, ex.getErrorCode());
        verify(movieAvailabilityRepository, never()).save(any());
    }

    @Test
    void createRejectsWhenClusterNotActive() {
        activeCluster.setStatus(ClusterStatus.INACTIVE);
        when(movieRepository.findById(1L)).thenReturn(Optional.of(approvedMovie));
        when(cinemaClusterRepository.findById(1L)).thenReturn(Optional.of(activeCluster));

        AppException ex = assertThrows(AppException.class,
                () -> service.create(createRequest(LocalDate.now(), null), "admin"));

        assertEquals(MovieErrorCode.AVAILABILITY_CLUSTER_NOT_ACTIVE, ex.getErrorCode());
    }

    @Test
    void createRejectsInvertedDateRange() {
        when(movieRepository.findById(1L)).thenReturn(Optional.of(approvedMovie));
        when(cinemaClusterRepository.findById(1L)).thenReturn(Optional.of(activeCluster));

        LocalDate start = LocalDate.now().plusDays(10);
        LocalDate end = LocalDate.now();

        AppException ex = assertThrows(AppException.class,
                () -> service.create(createRequest(start, end), "admin"));

        assertEquals(MovieErrorCode.AVAILABILITY_DATE_RANGE_INVALID, ex.getErrorCode());
        verify(movieAvailabilityRepository, never()).save(any());
    }

    @Test
    void createSucceedsAsPlannedWhenMovieApprovedAndClusterActive() {
        when(movieRepository.findById(1L)).thenReturn(Optional.of(approvedMovie));
        when(cinemaClusterRepository.findById(1L)).thenReturn(Optional.of(activeCluster));

        service.create(createRequest(LocalDate.now(), null), "admin");

        ArgumentCaptor<MovieAvailability> captor = ArgumentCaptor.forClass(MovieAvailability.class);
        verify(movieAvailabilityRepository).save(captor.capture());
        assertEquals(AvailabilityStatus.PLANNED, captor.getValue().getStatus());
    }

    // ── transition matrix ────────────────────────────────────────────────

    private MovieAvailability availabilityWith(AvailabilityStatus status) {
        return MovieAvailability.builder()
                .availabilityId(10L)
                .movie(approvedMovie)
                .cluster(activeCluster)
                .status(status)
                .showingStartDate(LocalDate.now())
                .build();
    }

    @Test
    void openRequiresPlanned() {
        when(movieAvailabilityRepository.findById(10L)).thenReturn(Optional.of(availabilityWith(AvailabilityStatus.OPEN)));

        AppException ex = assertThrows(AppException.class, () -> service.open(10L, "admin"));

        assertEquals(MovieErrorCode.AVAILABILITY_INVALID_TRANSITION, ex.getErrorCode());
    }

    @Test
    void openTransitionsPlannedToOpen() {
        MovieAvailability availability = availabilityWith(AvailabilityStatus.PLANNED);
        when(movieAvailabilityRepository.findById(10L)).thenReturn(Optional.of(availability));

        service.open(10L, "admin");

        assertEquals(AvailabilityStatus.OPEN, availability.getStatus());
    }

    @Test
    void suspendRequiresPlannedOrOpen() {
        when(movieAvailabilityRepository.findById(10L)).thenReturn(Optional.of(availabilityWith(AvailabilityStatus.CLOSED)));

        AppException ex = assertThrows(AppException.class, () -> service.suspend(10L, "Maintenance", "admin"));

        assertEquals(MovieErrorCode.AVAILABILITY_INVALID_TRANSITION, ex.getErrorCode());
    }

    @Test
    void suspendStoresReasonAndTransitions() {
        MovieAvailability availability = availabilityWith(AvailabilityStatus.OPEN);
        when(movieAvailabilityRepository.findById(10L)).thenReturn(Optional.of(availability));

        service.suspend(10L, "Projector maintenance", "admin");

        assertEquals(AvailabilityStatus.SUSPENDED, availability.getStatus());
        assertEquals("Projector maintenance", availability.getSuspensionReason());
    }

    @Test
    void resumeRequiresSuspended() {
        when(movieAvailabilityRepository.findById(10L)).thenReturn(Optional.of(availabilityWith(AvailabilityStatus.PLANNED)));

        AppException ex = assertThrows(AppException.class, () -> service.resume(10L, "admin"));

        assertEquals(MovieErrorCode.AVAILABILITY_INVALID_TRANSITION, ex.getErrorCode());
    }

    @Test
    void resumeTransitionsSuspendedToOpenAndClearsReason() {
        MovieAvailability availability = availabilityWith(AvailabilityStatus.SUSPENDED);
        availability.setSuspensionReason("Old reason");
        when(movieAvailabilityRepository.findById(10L)).thenReturn(Optional.of(availability));

        service.resume(10L, "admin");

        assertEquals(AvailabilityStatus.OPEN, availability.getStatus());
        assertEquals(null, availability.getSuspensionReason());
    }

    @Test
    void closeRejectsWhenAlreadyClosed() {
        when(movieAvailabilityRepository.findById(10L)).thenReturn(Optional.of(availabilityWith(AvailabilityStatus.CLOSED)));

        AppException ex = assertThrows(AppException.class, () -> service.close(10L, null, "admin"));

        assertEquals(MovieErrorCode.AVAILABILITY_INVALID_TRANSITION, ex.getErrorCode());
    }

    @Test
    void closeTransitionsFromAnyNonClosedStatus() {
        MovieAvailability availability = availabilityWith(AvailabilityStatus.SUSPENDED);
        when(movieAvailabilityRepository.findById(10L)).thenReturn(Optional.of(availability));

        service.close(10L, null, "admin");

        assertEquals(AvailabilityStatus.CLOSED, availability.getStatus());
    }

    @Test
    void closeAcceptsOptionalReasonAndRecordsIt() {
        MovieAvailability availability = availabilityWith(AvailabilityStatus.PLANNED);
        when(movieAvailabilityRepository.findById(10L)).thenReturn(Optional.of(availability));

        service.close(10L, "Cancelled before playing - distributor pulled the title", "admin");

        assertEquals(AvailabilityStatus.CLOSED, availability.getStatus());
        verify(movieAvailabilityHistoryRepository).save(argThat(history ->
                "Cancelled before playing - distributor pulled the title".equals(history.getReason())));
    }
}
