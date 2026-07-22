package movieservice.service;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.dto.response.SchedulePlanResponse;
import movieservice.entity.SchedulePlan;
import movieservice.entity.SchedulePlanSlot;
import movieservice.enums.SchedulePlanStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.SchedulePlanRepository;
import movieservice.service.autoshowtime.AutoShowtimeCandidatePersistenceService;
import movieservice.service.autoshowtime.AutoShowtimePersistenceResult;
import movieservice.service.autoshowtime.ShowtimeCandidate;
import movieservice.service.autoshowtime.SchedulingEligibilityService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class SchedulePlanService {
    private final SchedulePlanRepository schedulePlanRepository;
    private final AutoShowtimeCandidatePersistenceService persistenceService;
    private final SchedulingEligibilityService eligibilityService;

    @Transactional(readOnly = true)
    public SchedulePlanResponse get(Long planId) {
        return toResponse(schedulePlanRepository.findDetailedById(planId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SCHEDULE_PLAN_NOT_FOUND)));
    }

    @Transactional
    public SchedulePlanResponse submitReview(Long planId, String actor, String note) {
        SchedulePlan plan = loadForUpdate(planId);
        if (plan.getStatus() != SchedulePlanStatus.DRAFT_GENERATED
                && plan.getStatus() != SchedulePlanStatus.CHANGES_REQUESTED) {
            throw new AppException(MovieErrorCode.SCHEDULE_PLAN_INVALID_TRANSITION);
        }
        validateCurrentEligibility(plan);
        plan.setStatus(SchedulePlanStatus.IN_REVIEW);
        plan.setSubmittedAt(LocalDateTime.now());
        plan.setSubmittedBy(actor);
        plan.setReviewNote(note);
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
        return toResponse(plan);
    }

    @Transactional
    public SchedulePlanResponse publish(Long planId, String actor) {
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
        validateCurrentEligibility(plan);

        for (SchedulePlanSlot slot : plan.getSlots()) {
            if (slot.getPublishedShowtime() != null) continue;
            AutoShowtimePersistenceResult result = persistenceService.persist(
                    plan.getGenerationRun().getGenerationRunId(), toCandidate(slot),
                    plan.getGenerationRun().getPolicy().getCleanupBufferMinutes());
            if (!result.successful()) {
                throw new AppException(MovieErrorCode.SCHEDULE_PLAN_PUBLISH_CONFLICT);
            }
            slot.setPublishedShowtime(result.showtime());
        }

        plan.setStatus(SchedulePlanStatus.PUBLISHED);
        plan.setPublishedAt(LocalDateTime.now());
        plan.setPublishedBy(actor);
        return toResponse(plan);
    }

    private SchedulePlan loadForUpdate(Long planId) {
        return schedulePlanRepository.findByIdForUpdate(planId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SCHEDULE_PLAN_NOT_FOUND));
    }

    private void validateCurrentEligibility(SchedulePlan plan) {
        boolean invalid = plan.getSlots().stream().anyMatch(slot -> !eligibilityService.evaluate(
                slot.getMovie(), slot.getCinemaRoom().getCluster(),
                slot.getScreeningVersion(), slot.getBusinessDate()).eligible());
        if (invalid) {
            throw new AppException(MovieErrorCode.SCHEDULE_PLAN_ELIGIBILITY_CHANGED);
        }
    }

    private ShowtimeCandidate toCandidate(SchedulePlanSlot slot) {
        return ShowtimeCandidate.builder()
                .generationRunId(slot.getSchedulePlan().getGenerationRun().getGenerationRunId())
                .movieId(slot.getMovie().getMovieId())
                .clusterId(slot.getCinemaRoom().getCluster().getClusterId())
                .cinemaRoomId(slot.getCinemaRoom().getCinemaRoomId())
                .formatId(slot.getScreeningVersion().getFormat().getFormatId())
                .screeningVersionId(slot.getScreeningVersion().getScreeningVersionId())
                .showDate(slot.getBusinessDate())
                .startTime(slot.getStartAt().toLocalTime())
                .endTime(slot.getEndAt().toLocalTime())
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
                plan.getSlots().stream().map(this::toSlotResponse).toList(),
                plan.getSubmittedAt(), plan.getSubmittedBy(),
                plan.getPublishedAt(), plan.getPublishedBy(), plan.getReviewNote());
    }

    private SchedulePlanResponse.Slot toSlotResponse(SchedulePlanSlot slot) {
        return new SchedulePlanResponse.Slot(
                slot.getSchedulePlanSlotId(),
                slot.getMovie().getMovieId(), slot.getMovie().getOriginalTitle(),
                slot.getCinemaRoom().getCluster().getClusterId(),
                slot.getCinemaRoom().getCluster().getClusterName(),
                slot.getCinemaRoom().getCinemaRoomId(), slot.getCinemaRoom().getCinemaRoomName(),
                slot.getScreeningVersion().getScreeningVersionId(),
                slot.getScreeningVersion().getFormat().getFormatCode(),
                slot.getScreeningVersion().getAudioLanguageCode(),
                slot.getScreeningVersion().getSubtitleLanguageCode(),
                slot.getBusinessDate(), slot.getStartAt(), slot.getEndAt(),
                slot.getBasePrice(), slot.getTotalSeats(),
                slot.getGenerationReason() == null ? null : slot.getGenerationReason().name(),
                slot.getPublishedShowtime() == null ? null : slot.getPublishedShowtime().getShowTimeId());
    }
}
