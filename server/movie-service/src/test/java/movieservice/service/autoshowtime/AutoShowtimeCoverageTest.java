package movieservice.service.autoshowtime;

import movieservice.entity.CinemaClusterDemandProfile;
import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.repository.CinemaClusterDemandProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AutoShowtimeCoverageTest {
    @Mock CinemaClusterDemandProfileRepository profileRepository;

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
    void postValidatorReportsMinimumCoverageDeficit() {
        AutoShowtimePlanValidator validator = new AutoShowtimePlanValidator(profileRepository);
        List<ShowtimeCandidate> eligible = List.of(
                candidate(1L, 10L, LocalTime.of(9, 0), 100),
                candidate(1L, 10L, LocalTime.of(11, 0), 90));

        AutoShowtimePlanValidationResult result = validator.validate(run, eligible, eligible.subList(0, 1));

        assertFalse(result.valid());
        assertTrue(result.summary().contains("MINIMUM_COVERAGE"));
    }

    private ShowtimeCandidate candidate(Long movieId, Long roomId, LocalTime start, int score) {
        return ShowtimeCandidate.builder()
                .movieId(movieId).clusterId(1L).cinemaRoomId(roomId)
                .formatId(1).screeningVersionId(1L)
                .showDate(LocalDate.of(2026, 7, 25))
                .startTime(start).endTime(start.plusMinutes(90))
                .score(BigDecimal.valueOf(score)).build();
    }
}
