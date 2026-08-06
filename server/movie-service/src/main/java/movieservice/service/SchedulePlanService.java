package movieservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.response.SchedulePlanResponse;
import movieservice.dto.response.SchedulePlanSummaryResponse;
import movieservice.entity.SchedulePlan;
import movieservice.entity.SchedulePlanSlot;
import movieservice.entity.ShowTime;
import movieservice.enums.SchedulePlanStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.SchedulePlanRepository;
import movieservice.service.autoshowtime.AutoShowtimeCandidatePersistenceService;
import movieservice.service.autoshowtime.AutoShowtimePersistenceResult;
import movieservice.service.autoshowtime.ShowtimeCandidate;
import movieservice.service.autoshowtime.SchedulingEligibilityService;
import movieservice.service.autoshowtime.SchedulingOperationalConstraintService;
import movieservice.lifecycle.LifecycleEventNotifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SchedulePlanService {
    private static final ZoneId DEFAULT_BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final SchedulePlanRepository schedulePlanRepository;
    private final SchedulePlanRevalidationService revalidationService;
    private final AutoShowtimeCandidatePersistenceService persistenceService;
    private final ShowtimeInventoryService showtimeInventoryService;
    private final SchedulingEligibilityService eligibilityService;
    private final SchedulingOperationalConstraintService operationalConstraintService;
    private final LifecycleEventNotifier lifecycleEventNotifier;

    @Transactional(readOnly = true)
    public Page<SchedulePlanSummaryResponse> list(
            SchedulePlanStatus status,
            int page,
            int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(50, Math.max(1, size));
        return schedulePlanRepository.findSummaries(
                status,
                PageRequest.of(safePage, safeSize));
    }

    @Transactional(readOnly = true)
    public SchedulePlanResponse get(Long planId) {
        return toResponse(schedulePlanRepository.findDetailedById(planId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SCHEDULE_PLAN_NOT_FOUND)));
    }

    @Transactional(readOnly = true)
    public SchedulePlanResponse revalidate(Long planId, String actor) {
        revalidationService.revalidate(planId, actor);
        return toResponse(schedulePlanRepository.findDetailedById(planId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SCHEDULE_PLAN_NOT_FOUND)));
    }

    @Transactional
    public SchedulePlanResponse submitReview(Long planId, String actor, String note) {
        revalidationService.revalidate(planId, actor);
        SchedulePlan plan = loadForUpdate(planId);
        if (plan.getStatus() != SchedulePlanStatus.DRAFT_GENERATED
                && plan.getStatus() != SchedulePlanStatus.CHANGES_REQUESTED) {
            throw new AppException(MovieErrorCode.SCHEDULE_PLAN_INVALID_TRANSITION);
        }
        if (plan.getBlockerCount() != null && plan.getBlockerCount() > 0) {
            throw new AppException(MovieErrorCode.SCHEDULE_PLAN_REVIEW_BLOCKED);
        }
        validateCurrentEligibility(plan);
        plan.setStatus(SchedulePlanStatus.IN_REVIEW);
        plan.setSubmittedAt(LocalDateTime.now());
        plan.setSubmittedBy(actor);
        plan.setReviewNote(note);
        notifyChange(plan, "STATUS_CHANGED");
        return toResponse(plan);
    }

    @Transactional
    public SchedulePlanResponse requestChanges(Long planId, String actor, String note) {
        SchedulePlan plan = loadForUpdate(planId);
        if (plan.getStatus() != SchedulePlanStatus.IN_REVIEW) {
            throw new AppException(MovieErrorCode.SCHEDULE_PLAN_INVALID_TRANSITION);
        }
        plan.setStatus(SchedulePlanStatus.CHANGES_REQUESTED);
        plan.setReviewNote(note == null ? "Changes requested by " + actor : note);
        notifyChange(plan, "STATUS_CHANGED");
        return toResponse(plan);
    }

    @Transactional
    public SchedulePlanResponse publish(Long planId, String actor) {
        long startedAt = System.nanoTime();
        revalidationService.revalidate(planId, actor);
        SchedulePlan plan = loadForUpdate(planId);
        if (plan.getStatus() == SchedulePlanStatus.PUBLISHED) {
            return toResponse(plan);
        }
        if (plan.getStatus() != SchedulePlanStatus.IN_REVIEW) {
            throw new AppException(MovieErrorCode.SCHEDULE_PLAN_INVALID_TRANSITION);
        }
        if (plan.getBlockerCount() != null && plan.getBlockerCount() > 0) {
            throw new AppException(MovieErrorCode.SCHEDULE_PLAN_PUBLISH_CONFLICT);
        }
        if ((plan.getSubmittedBy() != null && plan.getSubmittedBy().equalsIgnoreCase(actor))
                || (plan.getGenerationRun().getRequestedBy() != null
                && plan.getGenerationRun().getRequestedBy().equalsIgnoreCase(actor))) {
            throw new AppException(MovieErrorCode.SCHEDULE_PLAN_SELF_PUBLISH_FORBIDDEN);
        }
        validateCurrentEligibility(plan);

        List<ShowTime> publishedShowtimes = new ArrayList<>(plan.getSlots().size());
        for (SchedulePlanSlot slot : plan.getSlots()) {
            if (slot.getPublishedShowtime() != null) {
                publishedShowtimes.add(slot.getPublishedShowtime());
                continue;
            }
            AutoShowtimePersistenceResult result = persistenceService.persist(
                    plan.getGenerationRun().getGenerationRunId(), toCandidate(slot),
                    plan.getGenerationRun().getPolicy().getCleanupBufferMinutes(), false);
            if (!result.successful()) {
                throw new AppException(MovieErrorCode.SCHEDULE_PLAN_PUBLISH_CONFLICT);
            }
            slot.setPublishedShowtime(result.showtime());
            publishedShowtimes.add(result.showtime());
        }

        int inventoryRows = showtimeInventoryService.materializeBatch(publishedShowtimes);

        plan.setStatus(SchedulePlanStatus.PUBLISHED);
        plan.setPublishedAt(LocalDateTime.now());
        plan.setPublishedBy(actor);
        notifyChange(plan, "STATUS_CHANGED");
        long elapsedMillis = (System.nanoTime() - startedAt) / 1_000_000;
        log.info(
                "[SchedulePlan] published planId={} showtimes={} inventoryRows={} elapsedMs={}",
                planId, publishedShowtimes.size(), inventoryRows, elapsedMillis);
        return toResponse(plan);
    }

    private void notifyChange(SchedulePlan plan, String action) {
        lifecycleEventNotifier.notifyChange(
                "SCHEDULE_PLAN",
                plan.getSchedulePlanId(),
                plan.getStatus().name(),
                action,
                null,
                null);
    }

    private SchedulePlan loadForUpdate(Long planId) {
        return schedulePlanRepository.findByIdForUpdate(planId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SCHEDULE_PLAN_NOT_FOUND));
    }

    private void validateCurrentEligibility(SchedulePlan plan) {
        boolean invalid = plan.getSlots().stream().anyMatch(slot ->
                !eligibilityService.evaluate(
                        slot.getMovie(), slot.getCinemaRoom().getCluster(),
                        slot.getScreeningVersion(), slot.getBusinessDate()).eligible()
                || !operationalConstraintService.evaluate(
                        slot.getCinemaRoom(), slot.getScreeningVersion(),
                        slot.getStartAt(), slot.getEndAt()).eligible());
        if (invalid) {
            throw new AppException(MovieErrorCode.SCHEDULE_PLAN_ELIGIBILITY_CHANGED);
        }
    }

    private ShowtimeCandidate toCandidate(SchedulePlanSlot slot) {
        OffsetDateTime localStartAt = toBusinessOffset(slot, slot.getStartAt());
        OffsetDateTime localEndAt = toBusinessOffset(slot, slot.getEndAt());
        return ShowtimeCandidate.builder()
                .generationRunId(slot.getSchedulePlan().getGenerationRun().getGenerationRunId())
                .movieId(slot.getMovie().getMovieId())
                .clusterId(slot.getCinemaRoom().getCluster().getClusterId())
                .cinemaRoomId(slot.getCinemaRoom().getCinemaRoomId())
                .formatId(slot.getScreeningVersion().getFormat().getFormatId())
                .screeningVersionId(slot.getScreeningVersion().getScreeningVersionId())
                .showDate(slot.getBusinessDate())
                .startTime(localStartAt.toLocalTime())
                .endTime(localEndAt.toLocalTime())
                .startAt(slot.getStartAt())
                .endAt(slot.getEndAt())
                .generationReason(slot.getGenerationReason())
                .build();
    }

    private SchedulePlanResponse toResponse(SchedulePlan plan) {
        return new SchedulePlanResponse(
                plan.getSchedulePlanId(),
                plan.getGenerationRun().getGenerationRunId(),
                plan.getStatus().name(),
                plan.getBlockerCount(),
                plan.getValidationSummary(),
                plan.getValidatedAt(),
                plan.getValidatedBy(),
                plan.getSlots().stream().map(this::toSlotResponse).toList(),
                plan.getSubmittedAt(), plan.getSubmittedBy(),
                plan.getPublishedAt(), plan.getPublishedBy(), plan.getReviewNote());
    }

    private SchedulePlanResponse.Slot toSlotResponse(SchedulePlanSlot slot) {
        OffsetDateTime localStartAt = toBusinessOffset(slot, slot.getStartAt());
        OffsetDateTime localEndAt = toBusinessOffset(slot, slot.getEndAt());
        return new SchedulePlanResponse.Slot(
                slot.getSchedulePlanSlotId(),
                slot.getMovie().getMovieId(),
                slot.getMovie().getOriginalTitle(),
                slot.getMovie().getPosterUrl(),
                slot.getCinemaRoom().getCluster().getClusterId(),
                slot.getCinemaRoom().getCluster().getClusterName(),
                slot.getCinemaRoom().getCinemaRoomId(), slot.getCinemaRoom().getCinemaRoomName(),
                slot.getScreeningVersion().getScreeningVersionId(),
                slot.getScreeningVersion().getFormat().getFormatCode(),
                slot.getScreeningVersion().getAudioLanguageCode(),
                slot.getScreeningVersion().getSubtitleLanguageCode(),
                slot.getBusinessDate(), localStartAt, localEndAt,
                slot.getBasePrice(), slot.getTotalSeats(),
                slot.getGenerationReason() == null ? null : slot.getGenerationReason().name(),
                toScoreBreakdown(slot),
                slot.getPublishedShowtime() == null ? null : slot.getPublishedShowtime().getShowTimeId());
    }

    private OffsetDateTime toBusinessOffset(SchedulePlanSlot slot, OffsetDateTime value) {
        String configuredZone = slot.getCinemaRoom().getCluster().getTimezone();
        ZoneId businessZone = configuredZone == null || configuredZone.isBlank()
                ? DEFAULT_BUSINESS_ZONE
                : ZoneId.of(configuredZone);
        return value.atZoneSameInstant(businessZone).toOffsetDateTime();
    }

    private SchedulePlanResponse.ScoreBreakdown toScoreBreakdown(SchedulePlanSlot slot) {
        if (slot.getAllocationScore() == null
                && slot.getMovieDemandScore() == null
                && slot.getClusterDemandScore() == null
                && slot.getTimeDemandScore() == null
                && slot.getFormatDemandScore() == null
                && slot.getCapacityFitScore() == null
                && slot.getExpectedAttendance() == null) {
            return null;
        }
        return new SchedulePlanResponse.ScoreBreakdown(
                slot.getAllocationScore(), slot.getDaypartCode(),
                slot.getMovieDemandScore(), slot.getClusterDemandScore(),
                slot.getTimeDemandScore(), slot.getFormatDemandScore(),
                slot.getCapacityFitScore(), slot.getExpectedAttendance(),
                slot.getTotalSeats());
    }
}
