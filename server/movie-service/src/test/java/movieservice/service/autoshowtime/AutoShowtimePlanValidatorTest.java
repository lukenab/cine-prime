package movieservice.service.autoshowtime;

import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.repository.CinemaClusterDemandProfileRepository;
import movieservice.repository.ShowTimeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AutoShowtimePlanValidatorTest {

    @Mock CinemaClusterDemandProfileRepository profileRepository;
    @Mock SchedulingOperationalConstraintService operationalConstraintService;
    @Mock ShowTimeRepository showTimeRepository;

    @Test
    void validateReportsOneOperationalBlockerPerRoomDateAndReason() {
        AutoShowtimePlanValidator validator = new AutoShowtimePlanValidator(
                profileRepository, operationalConstraintService, showTimeRepository);
        LocalDate date = LocalDate.of(2026, 8, 10);
        ShowtimeCandidate morning = candidate(date, LocalTime.of(8, 0), LocalTime.of(9, 0));
        ShowtimeCandidate evening = candidate(date, LocalTime.of(18, 0), LocalTime.of(19, 0));
        ShowtimeAllocationPolicy policy = ShowtimeAllocationPolicy.builder()
                .cleanupBufferMinutes(15)
                .minimumCoverage(0)
                .maximumRoomShare(BigDecimal.ONE)
                .sameMovieStaggerMinutes(0)
                .build();
        ShowtimeGenerationRun run = ShowtimeGenerationRun.builder().policy(policy).build();

        when(showTimeRepository.findActiveByRoomsAndDateRange(any(), any(), any())).thenReturn(List.of());
        when(profileRepository.findByCluster_ClusterId(1L)).thenReturn(Optional.empty());
        when(operationalConstraintService.evaluate(any(ShowtimeCandidate.class)))
                .thenReturn(SchedulingEligibilityResult.denied(List.of(
                        SchedulingOperationalConstraintService.ROOM_AUDIO_NOT_SUPPORTED)));

        AutoShowtimePlanValidationResult result = validator.validate(
                run, List.of(morning, evening), List.of(morning, evening));

        assertEquals(List.of(
                "OPERATIONAL_ELIGIBILITY: room=153 date=2026-08-10 reasons=ROOM_AUDIO_NOT_SUPPORTED"),
                result.blockers());
    }

    private ShowtimeCandidate candidate(LocalDate date, LocalTime start, LocalTime end) {
        return ShowtimeCandidate.builder()
                .movieId(1L)
                .clusterId(1L)
                .cinemaRoomId(153L)
                .screeningVersionId(10L)
                .formatId(1)
                .showDate(date)
                .startTime(start)
                .endTime(end)
                .build();
    }
}
