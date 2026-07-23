package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.entity.SchedulePlan;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.SchedulePlanStatus;
import movieservice.repository.SchedulePlanRepository;
import movieservice.service.autoshowtime.AutoShowtimeCandidatePersistenceService;
import movieservice.service.autoshowtime.SchedulingEligibilityService;
import movieservice.service.autoshowtime.SchedulingOperationalConstraintService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SchedulePlanServiceTest {
    @Mock SchedulePlanRepository schedulePlanRepository;
    @Mock AutoShowtimeCandidatePersistenceService persistenceService;
    @Mock SchedulingEligibilityService eligibilityService;
    @Mock SchedulingOperationalConstraintService operationalConstraintService;

    private SchedulePlanService service;

    @BeforeEach
    void setUp() {
        service = new SchedulePlanService(
                schedulePlanRepository, persistenceService,
                eligibilityService, operationalConstraintService);
    }

    @Test
    void listClampsInvalidPaginationBeforeLoadingPlanSummaries() {
        when(schedulePlanRepository.findSummaries(eq(SchedulePlanStatus.IN_REVIEW), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        var result = service.list(SchedulePlanStatus.IN_REVIEW, -3, 500);

        assertTrue(result.isEmpty());
        verify(schedulePlanRepository).findSummaries(
                eq(SchedulePlanStatus.IN_REVIEW),
                argThat(pageable -> pageable.getPageNumber() == 0 && pageable.getPageSize() == 50));
    }

    @Test
    void submitReviewMovesGeneratedDraftIntoReview() {
        SchedulePlan plan = plan(SchedulePlanStatus.DRAFT_GENERATED);
        when(schedulePlanRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(plan));

        var response = service.submitReview(10L, "admin-1", "Ready for review");

        assertEquals(SchedulePlanStatus.IN_REVIEW, plan.getStatus());
        assertEquals("IN_REVIEW", response.status());
        assertEquals("admin-1", response.submittedBy());
        assertNotNull(response.submittedAt());
    }

    @Test
    void publishRejectsDraftThatHasNotBeenReviewed() {
        SchedulePlan plan = plan(SchedulePlanStatus.DRAFT_GENERATED);
        when(schedulePlanRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(plan));

        assertThrows(AppException.class, () -> service.publish(10L, "admin-1"));
        verifyNoInteractions(persistenceService);
    }

    @Test
    void publishingAnAlreadyPublishedPlanIsIdempotent() {
        SchedulePlan plan = plan(SchedulePlanStatus.PUBLISHED);
        when(schedulePlanRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(plan));

        var response = service.publish(10L, "admin-2");

        assertEquals("PUBLISHED", response.status());
        verifyNoInteractions(persistenceService);
    }

    @Test
    void publishingAPlanWithValidationBlockersIsRejected() {
        SchedulePlan plan = plan(SchedulePlanStatus.IN_REVIEW);
        plan.setBlockerCount(2);
        when(schedulePlanRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(plan));

        assertThrows(AppException.class, () -> service.publish(10L, "admin-2"));
        verifyNoInteractions(persistenceService);
    }

    @Test
    void blockedPlanCanStillBeReturnedForChanges() {
        SchedulePlan plan = plan(SchedulePlanStatus.IN_REVIEW);
        plan.setBlockerCount(2);
        when(schedulePlanRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(plan));

        var response = service.requestChanges(10L, "admin-2", "Resolve blockers");

        assertEquals("CHANGES_REQUESTED", response.status());
    }

    private SchedulePlan plan(SchedulePlanStatus status) {
        return SchedulePlan.builder()
                .schedulePlanId(10L)
                .generationRun(ShowtimeGenerationRun.builder().generationRunId(20L).build())
                .status(status)
                .slots(new ArrayList<>())
                .build();
    }
}
