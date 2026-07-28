package movieservice.service;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.ShowtimeAllocationFormatPriorityRequest;
import movieservice.dto.request.ShowtimeAllocationPolicyRequest;
import movieservice.dto.request.ShowtimeDaypartPolicyRequest;
import movieservice.dto.response.ShowtimeAllocationFormatPriorityResponse;
import movieservice.dto.response.ShowtimeAllocationPolicyResponse;
import movieservice.dto.response.ShowtimeDaypartPolicyResponse;
import movieservice.entity.ScreeningFormat;
import movieservice.entity.ShowtimeAllocationFormatPriority;
import movieservice.entity.ShowtimeAllocationFormatPriorityId;
import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.entity.ShowtimeDaypartPolicy;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.ScreeningFormatRepository;
import movieservice.repository.ShowtimeAllocationFormatPriorityRepository;
import movieservice.repository.ShowtimeAllocationPolicyRepository;
import movieservice.repository.ShowtimeDaypartPolicyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Admin CRUD for {@link ShowtimeAllocationPolicy}. Before this, the entity only had a read-only
 * {@code GET /policy} endpoint (planning horizon lookup) - every weight, solver setting, and
 * timing field was DB/migration-only with no create/update path at all.
 *
 * <p>Important caveat surfaced to the UI: {@link AutoShowtimeGenerationService} always resolves
 * the run policy via {@code findByPolicyCodeAndActiveTrue("DEFAULT")} - it never looks up any
 * other policy_code. So creating a policy with a different code doesn't plug into any run;
 * managing multiple rows is only meaningful if the intent is to keep alternates ready and swap
 * which one is active=true under the "DEFAULT" code. The controller/UI must make that explicit
 * rather than implying every row here is independently "live".
 */
@Service
@RequiredArgsConstructor
public class ShowtimeAllocationPolicyAdminService {

    private final ShowtimeAllocationPolicyRepository policyRepository;
    private final ShowtimeAllocationFormatPriorityRepository formatPriorityRepository;
    private final ScreeningFormatRepository screeningFormatRepository;
    private final ShowtimeDaypartPolicyRepository daypartPolicyRepository;

    public List<ShowtimeAllocationPolicyResponse> listAll() {
        return policyRepository.findAllByOrderByUpdatedAtDesc().stream().map(this::toResponse).toList();
    }

    public ShowtimeAllocationPolicyResponse getById(Long policyId) {
        return toResponse(loadOrThrow(policyId));
    }

    @Transactional
    public ShowtimeAllocationPolicyResponse create(ShowtimeAllocationPolicyRequest request, String actor) {
        policyRepository.findByPolicyCode(request.policyCode()).ifPresent(existing -> {
            throw new AppException(MovieErrorCode.ALLOCATION_POLICY_CODE_DUPLICATE);
        });

        ShowtimeAllocationPolicy policy = ShowtimeAllocationPolicy.builder().build();
        applyRequest(policy, request);
        policy.setCreatedBy(actor);
        policy.setUpdatedBy(actor);
        ShowtimeAllocationPolicy saved = policyRepository.save(policy);
        replaceFormatPriorities(saved, request.formatPriorities());
        replaceDaypartPolicies(saved, request.daypartPolicies());
        return toResponse(loadOrThrow(saved.getPolicyId()));
    }

    @Transactional
    public ShowtimeAllocationPolicyResponse update(Long policyId, ShowtimeAllocationPolicyRequest request, String actor) {
        ShowtimeAllocationPolicy policy = loadOrThrow(policyId);

        policyRepository.findByPolicyCode(request.policyCode()).ifPresent(existing -> {
            if (!existing.getPolicyId().equals(policyId)) {
                throw new AppException(MovieErrorCode.ALLOCATION_POLICY_CODE_DUPLICATE);
            }
        });

        applyRequest(policy, request);
        policy.setUpdatedBy(actor);
        ShowtimeAllocationPolicy saved = policyRepository.save(policy);
        replaceFormatPriorities(saved, request.formatPriorities());
        replaceDaypartPolicies(saved, request.daypartPolicies());
        return toResponse(loadOrThrow(saved.getPolicyId()));
    }

    /// Sets this policy active=true and deactivates every other active row that shares the same
    /// policy_code, so findByPolicyCodeAndActiveTrue (what every generation run actually reads)
    /// never sees more than one active match for a given code.
    @Transactional
    public ShowtimeAllocationPolicyResponse activate(Long policyId, String actor) {
        ShowtimeAllocationPolicy policy = loadOrThrow(policyId);
        policyRepository.findAllByPolicyCodeAndActiveTrueAndPolicyIdNot(policy.getPolicyCode(), policyId)
                .forEach(sibling -> {
                    sibling.setActive(false);
                    sibling.setUpdatedBy(actor);
                    policyRepository.save(sibling);
                });
        policy.setActive(true);
        policy.setUpdatedBy(actor);
        return toResponse(policyRepository.save(policy));
    }

    private ShowtimeAllocationPolicy loadOrThrow(Long policyId) {
        return policyRepository.findById(policyId)
                .orElseThrow(() -> new AppException(MovieErrorCode.ALLOCATION_POLICY_NOT_FOUND));
    }

    private void applyRequest(ShowtimeAllocationPolicy policy, ShowtimeAllocationPolicyRequest request) {
        policy.setPolicyCode(request.policyCode().trim());
        policy.setPeakDemandWeight(request.peakDemandWeight());
        policy.setMovieDemandWeight(request.movieDemandWeight());
        policy.setClusterDemandWeight(request.clusterDemandWeight());
        policy.setTimeSlotDemandWeight(request.timeSlotDemandWeight());
        policy.setFormatDemandWeight(request.formatDemandWeight());
        policy.setRoomCapacityWeight(request.roomCapacityWeight());
        policy.setMinimumCoverage(request.minimumCoverage());
        policy.setMaximumRoomShare(request.maximumRoomShare());
        policy.setPlanningHorizonStartDays(request.planningHorizonStartDays());
        policy.setPlanningHorizonEndDays(request.planningHorizonEndDays());
        policy.setCleanupBufferMinutes(request.cleanupBufferMinutes());
        policy.setTimeSlotIntervalMinutes(request.timeSlotIntervalMinutes());
        policy.setSameMovieStaggerMinutes(request.sameMovieStaggerMinutes());
        policy.setMaxSolveTimeSeconds(request.maxSolveTimeSeconds());
        policy.setSolverRandomSeed(request.solverRandomSeed() == null ? 42 : request.solverRandomSeed());
        policy.setSolverSearchWorkers(request.solverSearchWorkers());
        policy.setSolverRelativeGap(request.solverRelativeGap() == null ? java.math.BigDecimal.ZERO : request.solverRelativeGap());
        policy.setSolverLogSearchProgress(Boolean.TRUE.equals(request.solverLogSearchProgress()));
        policy.setMaxCandidatesPerMoviePerDay(request.maxCandidatesPerMoviePerDay());
        policy.setOptimizerFallbackToLegacyOnError(request.optimizerFallbackToLegacyOnError() == null
                || request.optimizerFallbackToLegacyOnError());
        policy.setDefaultOptimizerMode(request.defaultOptimizerMode());
        policy.setBusinessTimezone(request.businessTimezone().trim());
        policy.setPeakStartTime(request.peakStartTime());
        policy.setPeakEndTime(request.peakEndTime());
        if (request.active() != null) {
            policy.setActive(request.active());
        } else if (policy.getActive() == null) {
            policy.setActive(true);
        }
    }

    /// Full-replace: ShowtimeAllocationPolicy.formatPriorities has no cascade/orphanRemoval
    /// (see the entity), so saving the policy never touches its child rows - they must be
    /// deleted/re-inserted explicitly through their own repository.
    private void replaceFormatPriorities(ShowtimeAllocationPolicy policy, List<ShowtimeAllocationFormatPriorityRequest> items) {
        formatPriorityRepository.deleteByPolicy_PolicyId(policy.getPolicyId());
        if (items == null || items.isEmpty()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        for (ShowtimeAllocationFormatPriorityRequest item : items) {
            ScreeningFormat format = screeningFormatRepository.findById(item.formatId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.FORMAT_NOT_FOUND));
            ShowtimeAllocationFormatPriority entity = ShowtimeAllocationFormatPriority.builder()
                    .id(new ShowtimeAllocationFormatPriorityId(policy.getPolicyId(), format.getFormatId()))
                    .policy(policy)
                    .screeningFormat(format)
                    .allocationPriority(item.allocationPriority())
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            formatPriorityRepository.save(entity);
        }
    }

    /// Full-replace, same rationale as replaceFormatPriorities() above: ShowtimeDaypartPolicy
    /// rows have no cascade/orphanRemoval from the parent policy, so they must be
    /// deleted/re-inserted explicitly rather than relying on saving the policy itself.
    private void replaceDaypartPolicies(ShowtimeAllocationPolicy policy, List<ShowtimeDaypartPolicyRequest> items) {
        daypartPolicyRepository.deleteByPolicy_PolicyId(policy.getPolicyId());
        if (items == null || items.isEmpty()) {
            return;
        }
        for (ShowtimeDaypartPolicyRequest item : items) {
            ShowtimeDaypartPolicy entity = ShowtimeDaypartPolicy.builder()
                    .policy(policy)
                    .daypartCode(item.daypartCode())
                    .startTime(item.startTime())
                    .endTime(item.endTime())
                    .weekdayDemandMultiplier(item.weekdayDemandMultiplier())
                    .weekendDemandMultiplier(item.weekendDemandMultiplier())
                    .active(item.active() == null || item.active())
                    .build();
            daypartPolicyRepository.save(entity);
        }
    }

    private ShowtimeAllocationPolicyResponse toResponse(ShowtimeAllocationPolicy policy) {
        List<ShowtimeAllocationFormatPriorityResponse> priorities = formatPriorityRepository
                .findAllByPolicyIdWithFormat(policy.getPolicyId()).stream()
                .map(item -> new ShowtimeAllocationFormatPriorityResponse(
                        item.getScreeningFormat().getFormatId(),
                        item.getScreeningFormat().getFormatCode(),
                        item.getScreeningFormat().getFormatName(),
                        item.getAllocationPriority()))
                .toList();

        List<ShowtimeDaypartPolicyResponse> dayparts = daypartPolicyRepository
                .findAllByPolicy_PolicyIdOrderByStartTime(policy.getPolicyId()).stream()
                .map(item -> new ShowtimeDaypartPolicyResponse(
                        item.getDaypartPolicyId(),
                        item.getDaypartCode(),
                        item.getStartTime(),
                        item.getEndTime(),
                        item.getWeekdayDemandMultiplier(),
                        item.getWeekendDemandMultiplier(),
                        item.getActive()))
                .toList();

        return new ShowtimeAllocationPolicyResponse(
                policy.getPolicyId(),
                policy.getPolicyCode(),
                policy.getActive(),
                policy.getPeakDemandWeight(),
                policy.getMovieDemandWeight(),
                policy.getClusterDemandWeight(),
                policy.getTimeSlotDemandWeight(),
                policy.getFormatDemandWeight(),
                policy.getRoomCapacityWeight(),
                policy.getMinimumCoverage(),
                policy.getMaximumRoomShare(),
                policy.getPlanningHorizonStartDays(),
                policy.getPlanningHorizonEndDays(),
                policy.getCleanupBufferMinutes(),
                policy.getTimeSlotIntervalMinutes(),
                policy.getSameMovieStaggerMinutes(),
                policy.getMaxSolveTimeSeconds(),
                policy.getSolverRandomSeed(),
                policy.getSolverSearchWorkers(),
                policy.getSolverRelativeGap(),
                policy.getSolverLogSearchProgress(),
                policy.getMaxCandidatesPerMoviePerDay(),
                policy.getOptimizerFallbackToLegacyOnError(),
                policy.getDefaultOptimizerMode(),
                policy.getBusinessTimezone(),
                policy.getPeakStartTime(),
                policy.getPeakEndTime(),
                policy.getCreatedAt(),
                policy.getUpdatedAt(),
                policy.getCreatedBy(),
                policy.getUpdatedBy(),
                priorities,
                dayparts
        );
    }
}
