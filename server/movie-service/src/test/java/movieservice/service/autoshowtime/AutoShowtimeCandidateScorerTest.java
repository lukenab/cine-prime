package movieservice.service.autoshowtime;

import movieservice.entity.CinemaClusterDemandProfile;
import movieservice.entity.CinemaRoom;
import movieservice.entity.MovieSchedulingProfile;
import movieservice.entity.ScreeningFormat;
import movieservice.entity.ShowtimeAllocationFormatPriority;
import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.repository.CinemaClusterDemandProfileRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieSchedulingProfileRepository;
import movieservice.repository.ShowtimeAllocationFormatPriorityRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AutoShowtimeCandidateScorerTest {

    @Mock MovieSchedulingProfileRepository movieSchedulingProfileRepository;
    @Mock CinemaClusterDemandProfileRepository clusterDemandProfileRepository;
    @Mock CinemaRoomRepository cinemaRoomRepository;
    @Mock ShowtimeAllocationFormatPriorityRepository formatPriorityRepository;

    private AutoShowtimeCandidateScorer scorer;

    @BeforeEach
    void setUp() {
        scorer = new AutoShowtimeCandidateScorer(
                movieSchedulingProfileRepository,
                clusterDemandProfileRepository,
                cinemaRoomRepository,
                formatPriorityRepository
        );
    }

    @Test
    void scoreAndRankBoostsOnlyTheTimeComponentForPeakSlots() {
        ShowtimeAllocationPolicy policy = policy();
        ShowtimeGenerationRun run = ShowtimeGenerationRun.builder().policy(policy).build();
        CinemaRoom room = CinemaRoom.builder().cinemaRoomId(10L).totalSeatCapacity(100).build();

        when(cinemaRoomRepository.findAllById(any())).thenReturn(List.of(room));
        when(movieSchedulingProfileRepository.findByMovie_MovieId(1L)).thenReturn(Optional.of(
                MovieSchedulingProfile.builder().popularityScore(new BigDecimal("90")).build()
        ));
        when(clusterDemandProfileRepository.findByCluster_ClusterId(1L)).thenReturn(Optional.of(
                CinemaClusterDemandProfile.builder().demandScore(new BigDecimal("50")).build()
        ));
        when(formatPriorityRepository.findAllByPolicyIdWithFormat(1L)).thenReturn(List.of(
                ShowtimeAllocationFormatPriority.builder()
                        .screeningFormat(ScreeningFormat.builder().formatId(1).build())
                        .allocationPriority(10)
                        .build()
        ));

        List<ShowtimeCandidate> ranked = scorer.scoreAndRank(run, List.of(
                candidate(LocalTime.of(10, 0)),
                candidate(LocalTime.of(19, 0))
        ));
        Map<LocalTime, BigDecimal> scoreByStartTime = ranked.stream()
                .collect(java.util.stream.Collectors.toMap(
                        ShowtimeCandidate::getStartTime,
                        ShowtimeCandidate::getScore
                ));

        /// Peak: .9*.40 + .5*.25 + (1*.15*1.20) + 1*.10 + 1*.10 = .8650.
        /// Nếu nhân toàn bộ score như logic cũ thì kết quả sai thành .8820.
        assertEquals(new BigDecimal("0.8650"), scoreByStartTime.get(LocalTime.of(19, 0)));
        assertEquals(new BigDecimal("0.7450"), scoreByStartTime.get(LocalTime.of(10, 0)));
    }

    private ShowtimeAllocationPolicy policy() {
        return ShowtimeAllocationPolicy.builder()
                .policyId(1L)
                .movieDemandWeight(new BigDecimal("0.40"))
                .clusterDemandWeight(new BigDecimal("0.25"))
                .timeSlotDemandWeight(new BigDecimal("0.15"))
                .formatDemandWeight(new BigDecimal("0.10"))
                .roomCapacityWeight(new BigDecimal("0.10"))
                .peakDemandWeight(new BigDecimal("1.20"))
                .peakStartTime(LocalTime.of(18, 0))
                .peakEndTime(LocalTime.of(22, 0))
                .build();
    }

    private ShowtimeCandidate candidate(LocalTime startTime) {
        return ShowtimeCandidate.builder()
                .generationRunId(1L)
                .movieId(1L)
                .clusterId(1L)
                .cinemaRoomId(10L)
                .formatId(1)
                .showDate(LocalDate.of(2026, 7, 27))
                .startTime(startTime)
                .endTime(startTime.plusHours(2))
                .build();
    }
}
