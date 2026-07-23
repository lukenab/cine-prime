package movieservice.service.autoshowtime;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class AutoShowtimeRunDispatcherTest {

    @Mock AutoShowtimeRunExecutor runExecutor;
    @Mock AutoShowtimeRunFailureService runFailureService;

    @Test
    void dispatchExecutesAcceptedRun() {
        AutoShowtimeRunDispatcher dispatcher = new AutoShowtimeRunDispatcher(runExecutor, runFailureService);

        dispatcher.dispatch(42L);

        verify(runExecutor).execute(42L);
        verifyNoInteractions(runFailureService);
    }

    @Test
    void dispatchPersistsFailureWhenWorkerThrows() {
        IllegalStateException failure = new IllegalStateException("generation failed");
        doThrow(failure).when(runExecutor).execute(42L);
        AutoShowtimeRunDispatcher dispatcher = new AutoShowtimeRunDispatcher(runExecutor, runFailureService);

        dispatcher.dispatch(42L);

        verify(runFailureService).markFailed(42L, failure);
    }
}
