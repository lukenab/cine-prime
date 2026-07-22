package movieservice.service.autoshowtime;

import movieservice.entity.Movie;
import movieservice.entity.ProgrammingSharePolicy;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.ProgrammingShareMeasurementBasis;
import movieservice.repository.MovieRepository;
import movieservice.repository.ProgrammingSharePolicyRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VietnameseFilmShareServiceTest {
    @Mock ProgrammingSharePolicyRepository policyRepository;
    @Mock MovieRepository movieRepository;
    private VietnameseFilmShareService service;
    private ShowtimeGenerationRun run;

    @BeforeEach
    void setUp() {
        service = new VietnameseFilmShareService(policyRepository, movieRepository);
        run = ShowtimeGenerationRun.builder()
                .startDate(LocalDate.of(2026, 7, 25)).endDate(LocalDate.of(2026, 7, 26)).build();
        when(policyRepository.findApplicable(any(), any(), any())).thenReturn(Optional.of(
                ProgrammingSharePolicy.builder().policyCode("VN_2026").measurementBasis(
                                ProgrammingShareMeasurementBasis.SHOW_COUNT)
                        .requiredShare(new BigDecimal("0.2500")).hardEnforcement(true).build()));
        when(movieRepository.findAllById(any())).thenReturn(List.of(
                Movie.builder().movieId(1L).domesticProductionVerified(false).build(),
                Movie.builder().movieId(2L).domesticProductionVerified(true).build()));
    }

    @Test
    void prioritizesVerifiedDomesticTitlesBeforeDemandFill() {
        List<ShowtimeCandidate> prioritized = service.prioritize(run, List.of(candidate(1L), candidate(2L)));
        assertEquals(List.of(2L, 1L), prioritized.stream().map(ShowtimeCandidate::getMovieId).toList());
    }

    @Test
    void blocksClusterWhoseSelectedPlanIsBelowRequiredShare() {
        AutoShowtimePlanValidationResult result = service.validate(run, List.of(
                candidate(1L), candidate(1L), candidate(1L), candidate(1L)));
        assertFalse(result.valid());
        assertTrue(result.summary().contains("required=0.2500 actual=0.0000"));
    }

    @Test
    void acceptsClusterAtExactRequiredShare() {
        AutoShowtimePlanValidationResult result = service.validate(run, List.of(
                candidate(2L), candidate(1L), candidate(1L), candidate(1L)));
        assertTrue(result.valid());
    }

    private ShowtimeCandidate candidate(Long movieId) {
        return ShowtimeCandidate.builder().movieId(movieId).clusterId(10L).cinemaRoomId(20L)
                .showDate(LocalDate.of(2026, 7, 25)).startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(12, 0)).score(BigDecimal.ONE).build();
    }
}
