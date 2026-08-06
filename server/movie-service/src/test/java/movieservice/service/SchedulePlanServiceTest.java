package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.entity.*;
import movieservice.enums.SchedulePlanStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.SchedulePlanRepository;
import movieservice.service.autoshowtime.AutoShowtimeCandidatePersistenceService;
import movieservice.service.autoshowtime.SchedulingEligibilityService;
import movieservice.service.autoshowtime.SchedulingEligibilityResult;
import movieservice.service.autoshowtime.SchedulingOperationalConstraintService;
import movieservice.lifecycle.LifecycleEventNotifier;
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
import java.time.LocalDate;
import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SchedulePlanServiceTest {
    @Mock SchedulePlanRepository schedulePlanRepository;
    @Mock SchedulePlanRevalidationService revalidationService;
    @Mock AutoShowtimeCandidatePersistenceService persistenceService;
    @Mock ShowtimeInventoryService showtimeInventoryService;
    @Mock SchedulingEligibilityService eligibilityService;
    @Mock SchedulingOperationalConstraintService operationalConstraintService;
    @Mock LifecycleEventNotifier lifecycleEventNotifier;

    private SchedulePlanService service;

    @BeforeEach
    void setUp() {
        service = new SchedulePlanService(
                schedulePlanRepository, revalidationService, persistenceService,
                showtimeInventoryService,
                eligibilityService, operationalConstraintService, lifecycleEventNotifier);
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
        verify(revalidationService).revalidate(10L, "admin-1");
    }

    @Test
    void submitReviewRejectsPlanWithPublishingBlockers() {
        SchedulePlan plan = plan(SchedulePlanStatus.DRAFT_GENERATED);
        plan.setBlockerCount(2);
        when(schedulePlanRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(plan));

        AppException exception = assertThrows(
                AppException.class,
                () -> service.submitReview(10L, "admin-1", "Ready for review"));

        assertEquals(MovieErrorCode.SCHEDULE_PLAN_REVIEW_BLOCKED, exception.getErrorCode());
        assertEquals(SchedulePlanStatus.DRAFT_GENERATED, plan.getStatus());
        assertNull(plan.getSubmittedAt());
        verify(revalidationService).revalidate(10L, "admin-1");
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
        verify(revalidationService).revalidate(10L, "admin-2");
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
    void publishingDefersSeatInventoryAndMaterializesPlanInOneBatch() {
        SchedulePlan plan = plan(SchedulePlanStatus.IN_REVIEW);
        plan.setSubmittedBy("operator@cineprime.vn");
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(43L)
                .timezone("Asia/Ho_Chi_Minh")
                .build();
        CinemaRoom room = CinemaRoom.builder()
                .cinemaRoomId(3L)
                .cluster(cluster)
                .build();
        Movie movie = Movie.builder().movieId(61L).build();
        MovieScreeningVersion version = MovieScreeningVersion.builder()
                .screeningVersionId(11L)
                .format(ScreeningFormat.builder().formatId(1).build())
                .build();
        SchedulePlanSlot slot = SchedulePlanSlot.builder()
                .schedulePlan(plan)
                .movie(movie)
                .cinemaRoom(room)
                .screeningVersion(version)
                .businessDate(LocalDate.of(2026, 8, 8))
                .startAt(OffsetDateTime.parse("2026-08-08T01:00:00Z"))
                .endAt(OffsetDateTime.parse("2026-08-08T03:00:00Z"))
                .build();
        plan.getSlots().add(slot);
        ShowTime published = ShowTime.builder().showTimeId(99L).cinemaRoom(room).build();

        when(schedulePlanRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(plan));
        when(eligibilityService.evaluate(movie, cluster, version, slot.getBusinessDate()))
                .thenReturn(SchedulingEligibilityResult.allowed());
        when(operationalConstraintService.evaluate(
                room, version, slot.getStartAt(), slot.getEndAt()))
                .thenReturn(SchedulingEligibilityResult.allowed());
        when(persistenceService.persist(eq(20L), any(), eq(15), eq(false)))
                .thenReturn(movieservice.service.autoshowtime.AutoShowtimePersistenceResult
                        .created(published));
        when(showtimeInventoryService.materializeBatch(List.of(published))).thenReturn(150);

        var response = service.publish(10L, "admin@cineprime.vn");

        assertEquals("PUBLISHED", response.status());
        assertSame(published, slot.getPublishedShowtime());
        verify(persistenceService).persist(eq(20L), any(), eq(15), eq(false));
        verify(showtimeInventoryService).materializeBatch(List.of(published));
    }

    @Test
    void submittingAuthorCannotPublishOwnSchedulePlan() {
        SchedulePlan plan = plan(SchedulePlanStatus.IN_REVIEW);
        plan.setSubmittedBy("programmer@cineprime.vn");
        when(schedulePlanRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(plan));

        AppException ex = assertThrows(AppException.class,
                () -> service.publish(10L, "programmer@cineprime.vn"));

        assertEquals(MovieErrorCode.SCHEDULE_PLAN_SELF_PUBLISH_FORBIDDEN, ex.getErrorCode());
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

    @Test
    void getReturnsPlanSlotsInCinemaBusinessTimezone() {
        SchedulePlan plan = plan(SchedulePlanStatus.DRAFT_GENERATED);
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(43L)
                .clusterName("CinePrime Landmark 81")
                .timezone("Asia/Ho_Chi_Minh")
                .build();
        CinemaRoom room = CinemaRoom.builder()
                .cinemaRoomId(1L)
                .cinemaRoomName("Room 1")
                .cluster(cluster)
                .build();
        MovieScreeningVersion version = MovieScreeningVersion.builder()
                .screeningVersionId(11L)
                .format(ScreeningFormat.builder().formatId(1).formatCode("2D").build())
                .audioLanguageCode("vi")
                .build();
        SchedulePlanSlot slot = SchedulePlanSlot.builder()
                .schedulePlanSlotId(101L)
                .schedulePlan(plan)
                .movie(Movie.builder().movieId(61L).originalTitle("Moana").build())
                .cinemaRoom(room)
                .screeningVersion(version)
                .businessDate(LocalDate.of(2026, 7, 31))
                // PostgreSQL TIMESTAMPTZ commonly returns the same instant normalized to UTC.
                .startAt(OffsetDateTime.parse("2026-07-31T01:00:00Z"))
                .endAt(OffsetDateTime.parse("2026-07-31T02:50:00Z"))
                .build();
        plan.getSlots().add(slot);
        when(schedulePlanRepository.findDetailedById(10L)).thenReturn(Optional.of(plan));

        var response = service.get(10L);

        assertEquals(8, response.slots().getFirst().startAt().getHour());
        assertEquals(9, response.slots().getFirst().endAt().getHour());
        assertEquals(7 * 60, response.slots().getFirst().startAt().getOffset().getTotalSeconds() / 60);
    }

    private SchedulePlan plan(SchedulePlanStatus status) {
        return SchedulePlan.builder()
                .schedulePlanId(10L)
                .generationRun(ShowtimeGenerationRun.builder()
                        .generationRunId(20L)
                        .requestedBy("operator@cineprime.vn")
                        .policy(ShowtimeAllocationPolicy.builder().build())
                        .build())
                .status(status)
                .slots(new ArrayList<>())
                .build();
    }
}
