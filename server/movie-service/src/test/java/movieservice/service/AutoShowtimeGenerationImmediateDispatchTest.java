package movieservice.service;

import movieservice.dto.request.AutoShowtimeGenerationRequest;
import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.RoomLayout;
import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.ClusterStatus;
import movieservice.enums.LayoutStatus;
import movieservice.enums.MovieStatus;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.repository.SchedulePlanRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeAllocationPolicyRepository;
import movieservice.repository.ShowtimeGenerationRunRepository;
import movieservice.repository.ShowtimeGenerationSkipRepository;
import movieservice.service.autoshowtime.AutoShowtimeCandidateFactory;
import movieservice.service.autoshowtime.AutoShowtimeRunAcceptedEvent;
import movieservice.service.autoshowtime.AutoShowtimeRunExecutor;
import movieservice.service.autoshowtime.ShowtimeCandidate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AutoShowtimeGenerationImmediateDispatchTest {

    @Mock ShowtimeAllocationPolicyRepository policyRepository;
    @Mock ShowtimeGenerationRunRepository generationRunRepository;
    @Mock SchedulePlanRepository schedulePlanRepository;
    @Mock MovieRepository movieRepository;
    @Mock CinemaClusterRepository cinemaClusterRepository;
    @Mock CinemaRoomRepository cinemaRoomRepository;
    @Mock RoomLayoutRepository roomLayoutRepository;
    @Mock ShowTimeRepository showTimeRepository;
    @Mock ShowtimeGenerationSkipRepository showtimeGenerationSkipRepository;
    @Mock AutoShowtimeCandidateFactory candidateFactory;
    @Mock AutoShowtimeRunExecutor runExecutor;
    @Mock ApplicationEventPublisher eventPublisher;

    @InjectMocks AutoShowtimeGenerationService service;

    @Test
    void newlyPersistedRunPublishesImmediateDispatchEvent() {
        LocalDate start = LocalDate.now().plusDays(3);
        ShowtimeAllocationPolicy policy = ShowtimeAllocationPolicy.builder()
                .policyCode("DEFAULT")
                .planningHorizonStartDays(0)
                .planningHorizonEndDays(10)
                .businessTimezone("UTC")
                .build();
        Movie movie = Movie.builder().movieId(1L).originalTitle("Test Movie").status(MovieStatus.APPROVED).build();
        CinemaCluster cluster = CinemaCluster.builder().clusterId(2L).status(ClusterStatus.ACTIVE).build();
        CinemaRoom room = CinemaRoom.builder()
                .cinemaRoomId(3L)
                .status(CinemaRoomStatus.ACTIVE)
                .totalSeatCapacity(100)
                .build();
        RoomLayout layout = RoomLayout.builder()
                .status(LayoutStatus.ACTIVE)
                .personCapacity(100)
                .sellableUnitCount(100)
                .build();
        ShowtimeCandidate candidate = org.mockito.Mockito.mock(ShowtimeCandidate.class);

        when(policyRepository.findByPolicyCodeAndActiveTrue("DEFAULT")).thenReturn(Optional.of(policy));
        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(cinemaClusterRepository.findById(2L)).thenReturn(Optional.of(cluster));
        when(cinemaRoomRepository.findByCluster_ClusterId(2L)).thenReturn(List.of(room));
        when(roomLayoutRepository.findByCinemaRoomCinemaRoomIdAndStatus(3L, LayoutStatus.ACTIVE))
                .thenReturn(Optional.of(layout));
        when(candidate.getMovieId()).thenReturn(1L);
        when(candidateFactory.buildRawCandidates(any(ShowtimeGenerationRun.class))).thenReturn(List.of(candidate));
        when(generationRunRepository.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(generationRunRepository.saveAndFlush(any(ShowtimeGenerationRun.class))).thenAnswer(invocation -> {
            ShowtimeGenerationRun saved = invocation.getArgument(0);
            saved.setGenerationRunId(41L);
            return saved;
        });

        var response = service.submitRun(
                new AutoShowtimeGenerationRequest(start, start, List.of(2L), List.of(1L), null, null, null),
                "admin"
        );

        assertEquals(41L, response.generationRunId());
        ArgumentCaptor<AutoShowtimeRunAcceptedEvent> event = ArgumentCaptor.forClass(AutoShowtimeRunAcceptedEvent.class);
        verify(eventPublisher).publishEvent(event.capture());
        assertEquals(41L, event.getValue().generationRunId());
    }
}
