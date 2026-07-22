package movieservice.service.autoshowtime;

import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.GenerationRunStatus;
import movieservice.repository.ShowtimeGenerationRunRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AutoShowtimeRunStateServiceTest {
    @Mock ShowtimeGenerationRunRepository repository;
    private AutoShowtimeRunStateService service;
    private ShowtimeGenerationRun run;

    @BeforeEach
    void setUp() {
        service = new AutoShowtimeRunStateService(repository);
        run = ShowtimeGenerationRun.builder().generationRunId(1L).status(GenerationRunStatus.RUNNING).build();
        when(repository.findByGenerationRunIdForUpdate(1L)).thenReturn(Optional.of(run));
    }

    @Test
    void mixedPartitionOutcomeIsPartiallyCompleted() {
        service.finish(1L, 20, 8, 4, 2, 1, "one partition failed");
        assertEquals(GenerationRunStatus.PARTIALLY_COMPLETED, run.getStatus());
        assertEquals(2, run.getSuccessfulPartitionCount());
        assertEquals(1, run.getFailedPartitionCount());
    }

    @Test
    void allSuccessfulPartitionsAreCompleted() {
        service.finish(1L, 20, 12, 8, 3, 0, null);
        assertEquals(GenerationRunStatus.COMPLETED, run.getStatus());
    }

    @Test
    void noSuccessfulPartitionIsFailed() {
        service.finish(1L, 20, 0, 0, 0, 2, "database unavailable");
        assertEquals(GenerationRunStatus.FAILED, run.getStatus());
    }
}
