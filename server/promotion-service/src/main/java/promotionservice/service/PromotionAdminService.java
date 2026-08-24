package promotionservice.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movie.theater.common.security.JwtSecurityUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import promotionservice.dto.request.PromotionPriceRuleRequest;
import promotionservice.dto.request.PromotionTargetRequest;
import promotionservice.dto.request.PromotionUpsertRequest;
import promotionservice.dto.response.PromotionPageResponse;
import promotionservice.dto.response.PromotionResponse;
import promotionservice.dto.response.PromotionSummaryResponse;
import promotionservice.entity.Promotion;
import promotionservice.entity.PromotionAuditLog;
import promotionservice.entity.PromotionPriceRule;
import promotionservice.entity.PromotionTarget;
import promotionservice.enums.PromotionStatus;
import promotionservice.enums.PromotionAvailabilityStatus;
import promotionservice.exception.PromotionErrorCode;
import promotionservice.repository.PromotionAuditLogRepository;
import promotionservice.repository.PromotionRepository;
import promotionservice.validation.PromotionValidator;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PromotionAdminService {
    private final PromotionRepository promotionRepository;
    private final PromotionAuditLogRepository auditLogRepository;
    private final PromotionValidator promotionValidator;

    @Transactional
    public PromotionResponse create(PromotionUpsertRequest request) {
        String code = normalize(request.code());
        if (promotionRepository.existsByCodeIgnoreCase(code)) {
            throw new AppException(PromotionErrorCode.PROMOTION_CODE_EXISTS);
        }

        Promotion promotion = new Promotion();
        promotion.setStatus(PromotionStatus.DRAFT);
        promotion.setCreatedByAccountId(JwtSecurityUtils.getCurrentAccountId());
        promotionValidator.validateEditableFields(request);
        applyEditableFields(promotion, request);
        Promotion saved = promotionRepository.save(promotion);
        audit(saved, "CREATED");
        return response(saved);
    }

    @Transactional
    public PromotionResponse updateDraft(UUID id, PromotionUpsertRequest request) {
        Promotion promotion = required(id);
        PromotionStatus previous = promotion.getStatus();
        if (previous != PromotionStatus.DRAFT && previous != PromotionStatus.REJECTED) {
            throw new AppException(PromotionErrorCode.PROMOTION_NOT_DRAFT);
        }

        String code = normalize(request.code());
        if (!promotion.getCode().equalsIgnoreCase(code)
                && promotionRepository.existsByCodeIgnoreCase(code)) {
            throw new AppException(PromotionErrorCode.PROMOTION_CODE_EXISTS);
        }

        promotionValidator.validateEditableFields(request);
        promotion.replaceTargets(List.of());
        promotionRepository.flush();
        applyEditableFields(promotion, request);
        if (previous == PromotionStatus.REJECTED) {
            promotion.setStatus(PromotionStatus.DRAFT);
            clearApproval(promotion);
        }
        audit(promotion, "DRAFT_UPDATED",
                transitionDetail(previous, promotion.getStatus(), null, null));
        return response(promotion);
    }

    @Transactional
    public PromotionResponse submit(UUID id, String comment) {
        Promotion promotion = required(id);
        PromotionStatus previous = promotion.getStatus();
        if (previous != PromotionStatus.DRAFT && previous != PromotionStatus.REJECTED) {
            throw new AppException(PromotionErrorCode.PROMOTION_INVALID_TRANSITION);
        }

        promotion.setStatus(PromotionStatus.PENDING_APPROVAL);
        promotion.setSubmittedByAccountId(requiredActor());
        promotion.setSubmittedAt(OffsetDateTime.now());
        promotion.setApprovedByAccountId(null);
        promotion.setApprovedAt(null);
        audit(promotion, "SUBMITTED",
                transitionDetail(previous, promotion.getStatus(), "comment", comment));
        return response(promotion);
    }

    @Transactional
    public PromotionResponse approve(UUID id, String comment) {
        Promotion promotion = required(id);
        requirePendingApproval(promotion);
        String actor = requiredDecisionActor(promotion);
        PromotionStatus previous = promotion.getStatus();
        promotion.setStatus(PromotionStatus.APPROVED);
        promotion.setApprovedByAccountId(actor);
        promotion.setApprovedAt(OffsetDateTime.now());
        audit(promotion, "APPROVED",
                transitionDetail(previous, promotion.getStatus(), "comment", comment));
        return response(promotion);
    }

    @Transactional
    public PromotionResponse reject(UUID id, String reason) {
        Promotion promotion = required(id);
        requirePendingApproval(promotion);
        requiredDecisionActor(promotion);
        requireReason(reason);
        PromotionStatus previous = promotion.getStatus();
        promotion.setStatus(PromotionStatus.REJECTED);
        promotion.setApprovedByAccountId(null);
        promotion.setApprovedAt(null);
        audit(promotion, "REJECTED",
                transitionDetail(previous, promotion.getStatus(), "reason", reason));
        return response(promotion);
    }

    @Transactional
    public PromotionResponse activate(UUID id) {
        Promotion promotion = required(id);
        PromotionStatus previous = promotion.getStatus();
        if (previous != PromotionStatus.APPROVED && previous != PromotionStatus.PAUSED) {
            throw new AppException(PromotionErrorCode.PROMOTION_INVALID_TRANSITION);
        }

        promotion.setStatus(PromotionStatus.ACTIVE);
        String action = previous == PromotionStatus.PAUSED ? "RESUMED" : "ACTIVATED";
        audit(promotion, action, transitionDetail(previous, promotion.getStatus(), null, null));
        return response(promotion);
    }

    @Transactional
    public PromotionResponse pause(UUID id, String reason) {
        requireReason(reason);
        return transition(id, PromotionStatus.PAUSED, "PAUSED", reason, PromotionStatus.ACTIVE);
    }

    @Transactional
    public PromotionResponse archive(UUID id, String reason) {
        requireReason(reason);
        return transition(id, PromotionStatus.ARCHIVED, "ARCHIVED", reason,
                PromotionStatus.DRAFT, PromotionStatus.REJECTED, PromotionStatus.APPROVED,
                PromotionStatus.ACTIVE, PromotionStatus.PAUSED);
    }

    @Transactional
    public PromotionResponse get(UUID id) {
        return response(required(id));
    }

    @Transactional
    public PromotionPageResponse search(PromotionStatus status, String query, Pageable pageable) {
        // PostgreSQL cannot infer the SQL type of null used by lower/concat.
        String normalizedQuery = query == null ? "" : query.trim();
        Page<PromotionSummaryResponse> page = promotionRepository
                .searchAdmin(status, normalizedQuery, pageable)
                .map(this::summaryResponse);

        Map<PromotionStatus, Long> countsByStatus = promotionRepository.countByStatus().stream()
                .collect(java.util.stream.Collectors.toMap(
                        PromotionRepository.StatusCount::getStatus,
                        PromotionRepository.StatusCount::getTotal
                ));
        long draft = count(countsByStatus, PromotionStatus.DRAFT);
        long pendingApproval = count(countsByStatus, PromotionStatus.PENDING_APPROVAL);
        long approved = count(countsByStatus, PromotionStatus.APPROVED);
        long rejected = count(countsByStatus, PromotionStatus.REJECTED);
        long active = count(countsByStatus, PromotionStatus.ACTIVE);
        long paused = count(countsByStatus, PromotionStatus.PAUSED);
        long archived = count(countsByStatus, PromotionStatus.ARCHIVED);
        PromotionRepository.OperationalCounts operational = promotionRepository.countOperational(OffsetDateTime.now());
        long approvedOrScheduled = operational == null ? 0 : operational.getApprovedOrScheduled();
        long activeNow = operational == null ? 0 : operational.getActiveNow();

        return new PromotionPageResponse(
                page.getContent(), page.getTotalElements(), page.getTotalPages(), page.getNumber(), page.getSize(),
                new PromotionPageResponse.PromotionCounts(
                        draft + pendingApproval + approved + rejected + active + paused + archived,
                        draft, pendingApproval, approved, rejected, active, paused, archived,
                        approvedOrScheduled, activeNow
                )
        );
    }

    private long count(Map<PromotionStatus, Long> counts, PromotionStatus status) {
        return counts.getOrDefault(status, 0L);
    }

    private PromotionResponse transition(UUID id, PromotionStatus next, String action, String reason,
                                         PromotionStatus... allowed) {
        Promotion promotion = required(id);
        PromotionStatus previous = promotion.getStatus();
        boolean valid = java.util.Arrays.stream(allowed).anyMatch(status -> status == previous);
        if (!valid) {
            throw new AppException(PromotionErrorCode.PROMOTION_INVALID_TRANSITION);
        }
        promotion.setStatus(next);
        audit(promotion, action, transitionDetail(previous, next, "reason", reason));
        return response(promotion);
    }

    private void requirePendingApproval(Promotion promotion) {
        if (promotion.getStatus() != PromotionStatus.PENDING_APPROVAL) {
            throw new AppException(PromotionErrorCode.PROMOTION_INVALID_TRANSITION);
        }
    }

    private String requiredDecisionActor(Promotion promotion) {
        String actor = requiredActor();
        if (actor.equals(promotion.getSubmittedByAccountId())) {
            throw new AppException(PromotionErrorCode.PROMOTION_SELF_APPROVAL_FORBIDDEN);
        }
        return actor;
    }

    private String requiredActor() {
        String actor = JwtSecurityUtils.getCurrentAccountId();
        if (actor == null || actor.isBlank()) {
            throw new AppException(PromotionErrorCode.PROMOTION_ACTOR_REQUIRED);
        }
        return actor;
    }

    private void requireReason(String reason) {
        if (reason == null || reason.isBlank()) {
            throw new AppException(PromotionErrorCode.PROMOTION_ACTION_REASON_REQUIRED);
        }
    }

    private void clearApproval(Promotion promotion) {
        promotion.setSubmittedByAccountId(null);
        promotion.setSubmittedAt(null);
        promotion.setApprovedByAccountId(null);
        promotion.setApprovedAt(null);
    }

    private void applyEditableFields(Promotion promotion, PromotionUpsertRequest request) {
        promotion.setCode(normalize(request.code()));
        promotion.setName(request.name().trim());
        promotion.setDescription(request.description());
        promotion.setBenefitScope(request.benefitScope());
        promotion.setValidFrom(request.validFrom());
        promotion.setValidUntil(request.validUntil());
        promotion.setGlobalUsageLimit(request.globalUsageLimit());
        promotion.setPerAccountUsageLimit(request.perAccountUsageLimit());
        applyPriceRule(promotion, request.priceRule());
        promotion.replaceTargets(toTargets(request.targets()));
    }

    private void applyPriceRule(Promotion promotion, PromotionPriceRuleRequest request) {
        PromotionPriceRule rule = promotion.getPriceRule();
        if (rule == null) {
            rule = new PromotionPriceRule();
            promotion.replacePriceRule(rule);
        }
        rule.setDiscountType(request.discountType());
        rule.setPercentage(request.percentage());
        rule.setFixedAmount(request.fixedAmount());
        rule.setMaxDiscountAmount(request.maxDiscountAmount());
        rule.setMinimumOrderAmount(request.minimumOrderAmount() == null
                ? BigDecimal.ZERO : request.minimumOrderAmount());
        rule.setCurrency(request.currency() == null ? "VND" : request.currency().trim().toUpperCase());
    }

    private List<PromotionTarget> toTargets(List<PromotionTargetRequest> requests) {
        if (requests == null) {
            return List.of();
        }
        List<PromotionTarget> result = new ArrayList<>();
        for (PromotionTargetRequest request : requests) {
            PromotionTarget target = new PromotionTarget();
            target.setTargetType(request.targetType());
            target.setMovieId(request.movieId());
            target.setShowtimeId(request.showtimeId());
            result.add(target);
        }
        return result;
    }

    private Promotion required(UUID id) {
        return promotionRepository.findById(id)
                .orElseThrow(() -> new AppException(PromotionErrorCode.PROMOTION_NOT_FOUND));
    }

    private void audit(Promotion promotion, String action) {
        audit(promotion, action, Map.of("status", promotion.getStatus().name()));
    }

    private void audit(Promotion promotion, String action, Map<String, Object> detail) {
        PromotionAuditLog log = new PromotionAuditLog();
        log.setPromotion(promotion);
        log.setAction(action);
        log.setActorAccountId(JwtSecurityUtils.getCurrentAccountId());
        log.setDetail(detail);
        auditLogRepository.save(log);
    }

    private Map<String, Object> transitionDetail(PromotionStatus previous, PromotionStatus next,
                                                 String noteKey, String note) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("fromStatus", previous.name());
        detail.put("toStatus", next.name());
        if (noteKey != null && note != null && !note.isBlank()) {
            detail.put(noteKey, note.trim());
        }
        return detail;
    }

    private PromotionResponse response(Promotion promotion) {
        PromotionPriceRule rule = promotion.getPriceRule();
        List<PromotionResponse.AuditEntry> auditLog = auditLogRepository
                .findTop20ByPromotion_PromotionIdOrderByCreatedAtDesc(promotion.getPromotionId()).stream()
                .map(log -> new PromotionResponse.AuditEntry(log.getPromotionAuditLogId(), log.getAction(), log.getActorAccountId(),
                        log.getCreatedAt(), log.getDetail()))
                .toList();
        return new PromotionResponse(
                promotion.getPromotionId(), promotion.getCode(), promotion.getName(), promotion.getDescription(),
                promotion.getStatus(), availabilityStatus(promotion, OffsetDateTime.now()),
                promotion.getBenefitScope(), promotion.getValidFrom(), promotion.getValidUntil(),
                promotion.getGlobalUsageLimit(), promotion.getPerAccountUsageLimit(), promotion.getVersion(),
                promotion.getCreatedAt(), promotion.getUpdatedAt(),
                promotion.getActiveReservationCount(), promotion.getCommittedUsageCount(),
                new PromotionResponse.Workflow(
                        promotion.getCreatedByAccountId(), promotion.getSubmittedByAccountId(),
                        promotion.getSubmittedAt(), promotion.getApprovedByAccountId(), promotion.getApprovedAt()),
                new PromotionResponse.PriceRule(
                        rule.getDiscountType(), rule.getPercentage(), rule.getFixedAmount(),
                        rule.getMaxDiscountAmount(), rule.getMinimumOrderAmount(), rule.getCurrency()),
                promotion.getTargets().stream()
                        .map(target -> new PromotionResponse.Target(
                                target.getTargetType(), target.getMovieId(), target.getShowtimeId()))
                        .toList(),
                auditLog
        );
    }

    private PromotionSummaryResponse summaryResponse(Promotion promotion) {
        PromotionPriceRule rule = promotion.getPriceRule();
        return new PromotionSummaryResponse(
                promotion.getPromotionId(), promotion.getCode(), promotion.getName(), promotion.getStatus(),
                availabilityStatus(promotion, OffsetDateTime.now()),
                promotion.getBenefitScope(), promotion.getValidFrom(), promotion.getValidUntil(),
                promotion.getActiveReservationCount(), promotion.getCommittedUsageCount(),
                promotion.getGlobalUsageLimit(),
                new PromotionSummaryResponse.PriceRuleSummary(
                        rule.getDiscountType(), rule.getPercentage(), rule.getFixedAmount(),
                        rule.getMinimumOrderAmount(), rule.getCurrency())
        );
    }

    private PromotionAvailabilityStatus availabilityStatus(Promotion promotion, OffsetDateTime now) {
        if (promotion.getStatus() == PromotionStatus.ARCHIVED) {
            return PromotionAvailabilityStatus.ARCHIVED;
        }
        if (promotion.getStatus() == PromotionStatus.PAUSED) {
            return PromotionAvailabilityStatus.PAUSED;
        }
        if (promotion.getStatus() != PromotionStatus.ACTIVE) {
            return PromotionAvailabilityStatus.NOT_AVAILABLE;
        }
        if (promotion.getValidFrom() != null && promotion.getValidFrom().isAfter(now)) {
            return PromotionAvailabilityStatus.SCHEDULED;
        }
        if (promotion.getValidUntil() != null && !promotion.getValidUntil().isAfter(now)) {
            return PromotionAvailabilityStatus.ENDED;
        }
        if (promotion.getGlobalUsageLimit() != null
                && promotion.getActiveReservationCount() + promotion.getCommittedUsageCount()
                >= promotion.getGlobalUsageLimit()) {
            return PromotionAvailabilityStatus.QUOTA_EXHAUSTED;
        }
        return PromotionAvailabilityStatus.ACTIVE;
    }

    private String normalize(String code) {
        return code.trim().toUpperCase();
    }
}
