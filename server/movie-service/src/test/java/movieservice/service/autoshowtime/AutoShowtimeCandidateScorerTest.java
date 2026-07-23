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
import movieservice.repository.ShowtimeDaypartPolicyRepository;
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
    @Mock ShowtimeDaypartPolicyRepository daypartPolicyRepository;

    private AutoShowtimeCandidateScorer scorer;

    @BeforeEach
    void setUp() {
        scorer = new AutoShowtimeCandidateScorer(
                movieSchedulingProfileRepository,
                clusterDemandProfileRepository,
                cinemaRoomRepository,
                formatPriorityRepository,
                daypartPolicyRepository
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
        when(daypartPolicyRepository.findByPolicy_PolicyIdAndActiveTrueOrderByStartTime(1L))
                .thenReturn(List.of());

        List<ShowtimeCandidate> ranked = scorer.scoreAndRank(run, List.of(
                candidate(LocalTime.of(10, 0)),
                candidate(LocalTime.of(19, 0))
        ));
        Map<LocalTime, BigDecimal> scoreByStartTime = ranked.stream()
                .collect(java.util.stream.Collectors.toMap(
                        ShowtimeCandidate::getStartTime,
                        ShowtimeCandidate::getScore
                ));

        /// Expected attendance is independent of the candidate room; capacity fit now
        /// penalises empty seats instead of blindly rewarding the largest room.
        assertEquals(new BigDecimal("0.8620"), scoreByStartTime.get(LocalTime.of(19, 0)));
        assertEquals(new BigDecimal("0.7105"), scoreByStartTime.get(LocalTime.of(10, 0)));
        assertEquals(94, ranked.getFirst().getScoreBreakdown().expectedAttendance());
    }

    @Test
    void scoreAndRankUsesCapacityFitInsteadOfAlwaysChoosingLargestRoom() {
        ShowtimeAllocationPolicy policy = policy();
        ShowtimeGenerationRun run = ShowtimeGenerationRun.builder().policy(policy).build();
        CinemaRoom smallRoom = CinemaRoom.builder().cinemaRoomId(10L).totalSeatCapacity(50).build();
        CinemaRoom largeRoom = CinemaRoom.builder().cinemaRoomId(20L).totalSeatCapacity(200).build();

        when(cinemaRoomRepository.findAllById(any())).thenReturn(List.of(smallRoom, largeRoom));
        when(movieSchedulingProfileRepository.findByMovie_MovieId(1L)).thenReturn(Optional.of(
                MovieSchedulingProfile.builder().popularityScore(new BigDecimal("20")).build()));
        when(clusterDemandProfileRepository.findByCluster_ClusterId(1L)).thenReturn(Optional.of(
                CinemaClusterDemandProfile.builder().demandScore(new BigDecimal("20")).build()));
        when(formatPriorityRepository.findAllByPolicyIdWithFormat(1L)).thenReturn(List.of(
                ShowtimeAllocationFormatPriority.builder()
                        .screeningFormat(ScreeningFormat.builder().formatId(1).build())
                        .allocationPriority(10).build()));
        when(daypartPolicyRepository.findByPolicy_PolicyIdAndActiveTrueOrderByStartTime(1L))
                .thenReturn(List.of());

        ShowtimeCandidate small = candidate(LocalTime.of(10, 0)).toBuilder().cinemaRoomId(10L).build();
        ShowtimeCandidate large = candidate(LocalTime.of(10, 0)).toBuilder().cinemaRoomId(20L).build();
        List<ShowtimeCandidate> ranked = scorer.scoreAndRank(run, List.of(large, small));

        assertEquals(10L, ranked.getFirst().getCinemaRoomId());
        assertEquals(16, ranked.getFirst().getScoreBreakdown().expectedAttendance());
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
