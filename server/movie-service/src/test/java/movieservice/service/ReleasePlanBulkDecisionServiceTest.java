package movieservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.BulkReleasePlanDecisionRequest;
import movieservice.dto.response.BulkReleasePlanDecisionResponse;
import movieservice.dto.response.MovieAvailabilityResponse;
import movieservice.exception.MovieErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReleasePlanBulkDecisionServiceTest {

    @Mock MovieAvailabilityService availabilityService;
    @Mock ReleasePlanBulkDecisionOperationStore operationStore;

    private ReleasePlanBulkDecisionService service;

    @BeforeEach
    void setUp() {
        service = new ReleasePlanBulkDecisionService(availabilityService, operationStore, new ObjectMapper());
    }

    @Test
    void approvesIndependentlyAndReportsStalePlansWithoutRollingBackSuccesses() {
        BulkReleasePlanDecisionRequest request = request(
                plan(11L, 2L),
                plan(12L, 5L));
        when(operationStore.claim(eq("approver"), eq("bulk-1"), anyString()))
                .thenReturn(new ReleasePlanBulkDecisionOperationStore.Claim(91L, null));
        when(availabilityService.approve(11L, 2L, "approver", "Reviewed together"))
                .thenReturn(MovieAvailabilityResponse.builder().availabilityId(11L).status("APPROVED").build());
        when(availabilityService.approve(12L, 5L, "approver", "Reviewed together"))
                .thenThrow(new AppException(MovieErrorCode.AVAILABILITY_VERSION_CONFLICT));

        BulkReleasePlanDecisionResponse response = service.decide(request, "approver", "bulk-1");

        assertEquals(1, response.getSucceeded().size());
        assertEquals(11L, response.getSucceeded().getFirst().getAvailabilityId());
        assertEquals(1, response.getFailed().size());
        assertEquals(12L, response.getFailed().getFirst().getAvailabilityId());
        assertEquals(MovieErrorCode.AVAILABILITY_VERSION_CONFLICT.getCode(), response.getFailed().getFirst().getCode());
        verify(operationStore).complete(eq(91L), anyString());
    }

    @Test
    void replaysCompletedOperationWithoutApprovingAgain() throws Exception {
        BulkReleasePlanDecisionRequest request = request(plan(11L, 2L));
        BulkReleasePlanDecisionResponse cached = BulkReleasePlanDecisionResponse.builder()
                .operationKey("bulk-1")
                .succeeded(List.of(MovieAvailabilityResponse.builder().availabilityId(11L).build()))
                .failed(List.of())
                .build();
        when(operationStore.claim(eq("approver"), eq("bulk-1"), anyString()))
                .thenReturn(new ReleasePlanBulkDecisionOperationStore.Claim(
                        91L, new ObjectMapper().writeValueAsString(cached)));

        BulkReleasePlanDecisionResponse response = service.decide(request, "approver", "bulk-1");

        assertEquals(11L, response.getSucceeded().getFirst().getAvailabilityId());
        verifyNoInteractions(availabilityService);
        verify(operationStore, never()).complete(anyLong(), anyString());
    }

    @Test
    void rejectsMissingIdempotencyKeyBeforeStartingOperation() {
        AppException failure = assertThrows(AppException.class,
                () -> service.decide(request(plan(11L, 2L)), "approver", " "));

        assertEquals(MovieErrorCode.RELEASE_PLAN_BULK_IDEMPOTENCY_KEY_REQUIRED, failure.getErrorCode());
        verifyNoInteractions(operationStore, availabilityService);
    }

    private BulkReleasePlanDecisionRequest request(BulkReleasePlanDecisionRequest.PlanVersion... plans) {
        return BulkReleasePlanDecisionRequest.builder()
                .decision(BulkReleasePlanDecisionRequest.Decision.APPROVE)
                .plans(List.of(plans))
                .note("Reviewed together")
                .build();
    }

    private BulkReleasePlanDecisionRequest.PlanVersion plan(long id, long version) {
        return BulkReleasePlanDecisionRequest.PlanVersion.builder()
                .availabilityId(id)
                .expectedVersion(version)
                .build();
    }
}
