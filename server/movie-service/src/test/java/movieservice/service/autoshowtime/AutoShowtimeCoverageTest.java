package movieservice.service.autoshowtime;

import movieservice.entity.CinemaClusterDemandProfile;
import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.repository.CinemaClusterDemandProfileRepository;
import movieservice.repository.ShowTimeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AutoShowtimeCoverageTest {
    @Mock CinemaClusterDemandProfileRepository profileRepository;
    @Mock SchedulingOperationalConstraintService operationalConstraintService;
    @Mock ShowTimeRepository showTimeRepository;

    private ShowtimeGenerationRun run;
    private CinemaClusterDemandProfile profile;

    @BeforeEach
    void setUp() {
        profile = CinemaClusterDemandProfile.builder()
                .minDailyShows(2).maxDailyShowsPerMovie(2).build();
        run = ShowtimeGenerationRun.builder().policy(ShowtimeAllocationPolicy.builder()
                .minimumCoverage(2)
                .maximumRoomShare(BigDecimal.ONE)
                .cleanupBufferMinutes(0)
                .build()).build();
        when(profileRepository.findByCluster_ClusterId(1L)).thenReturn(Optional.of(profile));
        org.mockito.Mockito.lenient().when(showTimeRepository.findActiveByRoomsAndDateRange(
                org.mockito.ArgumentMatchers.anyList(),
                org.mockito.ArgumentMatchers.any(LocalDate.class),
                org.mockito.ArgumentMatchers.any(LocalDate.class)))
                .thenReturn(List.of());
    }

    @Test
    void selectorAllocatesCoverageInRoundRobinPasses() {
        AutoShowtimeCandidateSelector selector = new AutoShowtimeCandidateSelector(profileRepository);
        List<ShowtimeCandidate> ranked = List.of(
                candidate(1L, 10L, LocalTime.of(9, 0), 100),
                candidate(1L, 10L, LocalTime.of(11, 0), 90),
                candidate(2L, 20L, LocalTime.of(9, 0), 80),
                candidate(2L, 20L, LocalTime.of(11, 0), 70));

        AutoShowtimeSelectionResult result = selector.select(run, ranked);

        assertEquals(List.of(1L, 2L, 1L, 2L), result.selectedCandidates().stream()
                .map(ShowtimeCandidate::getMovieId).toList());
    }

    @Test
    void roomShareOnlyCountsRoomsUsedAtTheSameTime() {
        run.getPolicy().setMaximumRoomShare(new BigDecimal("0.5000"));
        AutoShowtimeCandidateSelector selector = new AutoShowtimeCandidateSelector(profileRepository);
        List<ShowtimeCandidate> ranked = List.of(
                candidate(1L, 10L, LocalTime.of(9, 0), 100),
                candidate(1L, 20L, LocalTime.of(11, 0), 90));

        AutoShowtimeSelectionResult result = selector.select(run, ranked);

        assertEquals(2, result.selectedCandidates().size());
    }

    @Test
    void selectorPreventsCrossBusinessDateOverlapInTheSameRoom() {
        AutoShowtimeCandidateSelector selector = new AutoShowtimeCandidateSelector(profileRepository);
        ShowtimeCandidate lateNight = candidateAt(1L, 10L,
                "2026-07-25T23:00:00+07:00", "2026-07-26T01:00:00+07:00", 100);
        ShowtimeCandidate nextBusinessDate = candidateAt(2L, 10L,
                "2026-07-26T00:30:00+07:00", "2026-07-26T02:00:00+07:00", 90);

        AutoShowtimeSelectionResult result = selector.select(run, List.of(lateNight, nextBusinessDate));

        assertEquals(1, result.selectedCandidates().size());
        assertTrue(result.rejectedCandidates().stream()
                .anyMatch(rejection -> rejection.reason() == movieservice.enums.GenerationSkipReason.CLEANUP_BUFFER_CONFLICT));
    }

    @Test
    void postValidatorReportsMinimumCoverageDeficit() {
        when(operationalConstraintService.evaluate(org.mockito.ArgumentMatchers.any(ShowtimeCandidate.class)))
                .thenReturn(SchedulingEligibilityResult.allowed());
        AutoShowtimePlanValidator validator = new AutoShowtimePlanValidator(
                profileRepository, operationalConstraintService, showTimeRepository);
        List<ShowtimeCandidate> eligible = List.of(
                candidate(1L, 10L, LocalTime.of(9, 0), 100),
                candidate(1L, 10L, LocalTime.of(11, 0), 90));

        AutoShowtimePlanValidationResult result = validator.validate(run, eligible, eligible.subList(0, 1));

        assertFalse(result.valid());
        assertTrue(result.summary().contains("MINIMUM_COVERAGE"));
    }

    @Test
    void postValidatorReportsSelectedSlotThatIsNoLongerEligible() {
        when(operationalConstraintService.evaluate(org.mockito.ArgumentMatchers.any(ShowtimeCandidate.class)))
                .thenReturn(SchedulingEligibilityResult.allowed());
        AutoShowtimePlanValidator validator = new AutoShowtimePlanValidator(
                profileRepository, operationalConstraintService, showTimeRepository);
        ShowtimeCandidate currentCandidate = candidateAt(
                1L, 10L,
                "2026-07-25T09:00:00+07:00",
                "2026-07-25T10:30:00+07:00",
                100);
        ShowtimeCandidate staleSelectedSlot = candidateAt(
                1L, 10L,
                "2026-07-25T11:00:00+07:00",
                "2026-07-25T12:30:00+07:00",
                90);

        AutoShowtimePlanValidationResult result = validator.validate(
                run, List.of(currentCandidate), List.of(staleSelectedSlot));

        assertFalse(result.valid());
        assertTrue(result.summary().contains("SLOT_NO_LONGER_ELIGIBLE"));
    }

    @Test
    void candidateEligibilityComparisonUsesInstantAcrossDifferentOffsets() {
        when(operationalConstraintService.evaluate(org.mockito.ArgumentMatchers.any(ShowtimeCandidate.class)))
                .thenReturn(SchedulingEligibilityResult.allowed());
        AutoShowtimePlanValidator validator = new AutoShowtimePlanValidator(
                profileRepository, operationalConstraintService, showTimeRepository);
        ShowtimeCandidate eligible = candidateAt(
                1L, 10L,
                "2026-07-25T09:00:00+07:00",
                "2026-07-25T10:30:00+07:00",
                100);
        ShowtimeCandidate persistedSlot = candidateAt(
                1L, 10L,
                "2026-07-25T02:00:00Z",
                "2026-07-25T03:30:00Z",
                100);

        AutoShowtimePlanValidationResult result = validator.validate(
                run, List.of(eligible), List.of(persistedSlot));

        assertFalse(result.summary().contains("SLOT_NO_LONGER_ELIGIBLE"));
    }

    @Test
    void existingCommittedShowtimeCountsTowardMinimumCoverage() {
        when(operationalConstraintService.evaluate(org.mockito.ArgumentMatchers.any(ShowtimeCandidate.class)))
                .thenReturn(SchedulingEligibilityResult.allowed());
        AutoShowtimePlanValidator validator = new AutoShowtimePlanValidator(
                profileRepository, operationalConstraintService, showTimeRepository);
        List<ShowtimeCandidate> eligible = List.of(
                candidate(1L, 10L, LocalTime.of(9, 0), 100),
                candidate(1L, 10L, LocalTime.of(11, 0), 90));
        Movie movie = Movie.builder().movieId(1L).build();
        CinemaCluster cluster = CinemaCluster.builder().clusterId(1L).build();
        CinemaRoom room = CinemaRoom.builder().cinemaRoomId(10L).cluster(cluster).build();
        ShowTime existing = ShowTime.builder()
                .movie(movie)
                .cinemaRoom(room)
                .showDate(LocalDate.of(2026, 7, 25))
                .build();
        when(showTimeRepository.findActiveByRoomsAndDateRange(
                List.of(10L),
                LocalDate.of(2026, 7, 25),
                LocalDate.of(2026, 7, 25)))
                .thenReturn(List.of(existing));

        AutoShowtimePlanValidationResult result = validator.validate(
                run, eligible, eligible.subList(0, 1));

        assertTrue(result.valid());
        assertFalse(result.summary().contains("MINIMUM_COVERAGE"));
    }

    private ShowtimeCandidate candidate(Long movieId, Long roomId, LocalTime start, int score) {
        return ShowtimeCandidate.builder()
                .movieId(movieId).clusterId(1L).cinemaRoomId(roomId)
                .formatId(1).screeningVersionId(1L)
                .showDate(LocalDate.of(2026, 7, 25))
                .startTime(start).endTime(start.plusMinutes(90))
                .score(BigDecimal.valueOf(score)).build();
    }

    private ShowtimeCandidate candidateAt(
            Long movieId,
            Long roomId,
            String start,
            String end,
            int score
    ) {
        OffsetDateTime startAt = OffsetDateTime.parse(start);
        OffsetDateTime endAt = OffsetDateTime.parse(end);
        return ShowtimeCandidate.builder()
                .movieId(movieId).clusterId(1L).cinemaRoomId(roomId)
                .formatId(1).screeningVersionId(1L)
                .showDate(startAt.toLocalDate())
                .startTime(startAt.toLocalTime()).endTime(endAt.toLocalTime())
                .startAt(startAt).endAt(endAt)
                .score(BigDecimal.valueOf(score)).build();
    }
}
