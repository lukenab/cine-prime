package movieservice.service.autoshowtime;

import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.GenerationRunStatus;
import movieservice.repository.ShowtimeGenerationRunRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * A RUNNING row with no active worker (the worker died mid-flight, e.g. a restart during a
 * CP-SAT solve) has no other recovery path - unlike ACCEPTED, nothing else ever picks it back up.
 * This proves the sweep actually reclaims stale rows and leaves fresh ones alone.
 */
@ExtendWith(MockitoExtension.class)
class AutoShowtimeGenerationSchedulerTest {

    @Mock ShowtimeGenerationRunRepository generationRunRepository;
    @Mock AutoShowtimeRunDispatcher runDispatcher;
    @Mock AutoShowtimeRunStateService runStateService;

    private AutoShowtimeGenerationScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new AutoShowtimeGenerationScheduler(generationRunRepository, runDispatcher, runStateService);
    }

    @Test
    void reclaimsRunsThatHaveBeenRunningLongerThanTheThreshold() {
        ShowtimeGenerationRun staleRun = ShowtimeGenerationRun.builder()
                .generationRunId(15L)
                .status(GenerationRunStatus.RUNNING)
                .startedAt(LocalDateTime.now().minusMinutes(30))
                .build();
        when(generationRunRepository.findTop20ByStatusAndStartedAtBeforeOrderByStartedAtAsc(
                eq(GenerationRunStatus.RUNNING), any())).thenReturn(List.of(staleRun));
        when(runStateService.reclaimIfStillRunning(eq(15L), any())).thenReturn(true);

        scheduler.reclaimStaleRunningRuns();

        ArgumentCaptor<String> detail = ArgumentCaptor.forClass(String.class);
        verify(runStateService).reclaimIfStillRunning(eq(15L), detail.capture());
        assertTrue(detail.getValue().contains("orphaned"));
    }

    @Test
    void doesNotTouchRunsStillWithinTheThreshold() {
        when(generationRunRepository.findTop20ByStatusAndStartedAtBeforeOrderByStartedAtAsc(
                eq(GenerationRunStatus.RUNNING), any())).thenReturn(List.of());

        scheduler.reclaimStaleRunningRuns();

        verify(runStateService, org.mockito.Mockito.never()).reclaimIfStillRunning(anyLong(), any());
    }
}
