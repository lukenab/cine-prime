package movieservice.service;

import movieservice.entity.SchedulePlan;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.SchedulePlanStatus;
import movieservice.repository.SchedulePlanRepository;
import movieservice.service.autoshowtime.AutoShowtimeCandidateFactory;
import movieservice.service.autoshowtime.AutoShowtimePlanValidationResult;
import movieservice.service.autoshowtime.AutoShowtimePlanValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SchedulePlanRevalidationServiceTest {
    @Mock SchedulePlanRepository schedulePlanRepository;
    @Mock AutoShowtimeCandidateFactory candidateFactory;
    @Mock AutoShowtimePlanValidator planValidator;

    @Test
    void revalidationReplacesStaleBlockerSnapshotAndRecordsActor() {
        ShowtimeGenerationRun run = ShowtimeGenerationRun.builder()
                .generationRunId(20L)
                .build();
        SchedulePlan plan = SchedulePlan.builder()
                .schedulePlanId(10L)
                .generationRun(run)
                .status(SchedulePlanStatus.IN_REVIEW)
                .blockerCount(2)
                .validationSummary("STALE_BLOCKER")
                .slots(new ArrayList<>())
                .build();
        when(schedulePlanRepository.findByIdForUpdate(10L))
                .thenReturn(Optional.of(plan));
        when(candidateFactory.buildRawCandidates(run)).thenReturn(List.of());
        when(planValidator.validate(run, List.of(), List.of()))
                .thenReturn(new AutoShowtimePlanValidationResult(List.of()));

        new SchedulePlanRevalidationService(
                schedulePlanRepository,
                candidateFactory,
                planValidator)
                .revalidate(10L, "admin-1");

        assertEquals(0, plan.getBlockerCount());
        assertEquals("", plan.getValidationSummary());
        assertEquals("admin-1", plan.getValidatedBy());
        assertNotNull(plan.getValidatedAt());
    }
}
