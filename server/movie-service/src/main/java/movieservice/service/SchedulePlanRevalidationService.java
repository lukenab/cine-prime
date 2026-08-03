package movieservice.service;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.entity.SchedulePlan;
import movieservice.entity.SchedulePlanSlot;
import movieservice.enums.SchedulePlanStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.SchedulePlanRepository;
import movieservice.service.autoshowtime.AutoShowtimeCandidateFactory;
import movieservice.service.autoshowtime.AutoShowtimePlanValidationResult;
import movieservice.service.autoshowtime.AutoShowtimePlanValidator;
import movieservice.service.autoshowtime.ShowtimeCandidate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * Rebuilds a plan validation snapshot from live scheduling resources.
 *
 * <p>The transaction is independent so the refreshed blocker snapshot remains
 * available to reviewers even when a following submit or publish transition is rejected.</p>
 */
@Service
@RequiredArgsConstructor
public class SchedulePlanRevalidationService {
    private static final ZoneId DEFAULT_BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final SchedulePlanRepository schedulePlanRepository;
    private final AutoShowtimeCandidateFactory candidateFactory;
    private final AutoShowtimePlanValidator planValidator;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void revalidate(Long planId, String actor) {
        SchedulePlan plan = schedulePlanRepository.findByIdForUpdate(planId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SCHEDULE_PLAN_NOT_FOUND));

        if (plan.getStatus() == SchedulePlanStatus.PUBLISHED) {
            return;
        }

        List<ShowtimeCandidate> eligibleCandidates =
                candidateFactory.buildRawCandidates(plan.getGenerationRun());
        List<ShowtimeCandidate> selectedCandidates = plan.getSlots().stream()
                .map(this::toCandidate)
                .toList();
        AutoShowtimePlanValidationResult validation =
                planValidator.validate(
                        plan.getGenerationRun(),
                        eligibleCandidates,
                        selectedCandidates);

        plan.setBlockerCount(validation.blockers().size());
        plan.setValidationSummary(validation.summary());
        plan.setValidatedAt(LocalDateTime.now());
        plan.setValidatedBy(actor);
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

    private OffsetDateTime toBusinessOffset(SchedulePlanSlot slot, OffsetDateTime value) {
        String configuredZone = slot.getCinemaRoom().getCluster().getTimezone();
        ZoneId businessZone = configuredZone == null || configuredZone.isBlank()
                ? DEFAULT_BUSINESS_ZONE
                : ZoneId.of(configuredZone);
        return value.atZoneSameInstant(businessZone).toOffsetDateTime();
    }
}
