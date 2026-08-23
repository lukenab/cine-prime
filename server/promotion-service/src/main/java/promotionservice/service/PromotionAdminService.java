package promotionservice.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movie.theater.common.security.JwtSecurityUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import promotionservice.dto.request.*;
import promotionservice.dto.response.PromotionResponse;
import promotionservice.dto.response.PromotionPageResponse;
import promotionservice.dto.response.PromotionSummaryResponse;
import promotionservice.entity.*;
import promotionservice.enums.PromotionStatus;
import promotionservice.exception.PromotionErrorCode;
import promotionservice.repository.PromotionAuditLogRepository;
import promotionservice.repository.PromotionRepository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import promotionservice.validation.PromotionValidator;

@Service
@RequiredArgsConstructor
public class PromotionAdminService {
    private final PromotionRepository promotionRepository;
    private final PromotionAuditLogRepository auditLogRepository;
    private final PromotionValidator promotionValidator;

    @Transactional
    public PromotionResponse create(PromotionUpsertRequest request) {
        /// Chuẩn hóa trước khi kiểm tra trùng để SUMMER26 và summer26 được xem là một mã.
        String code = normalize(request.code());
        if (promotionRepository.existsByCodeIgnoreCase(code))
            throw new AppException(PromotionErrorCode.PROMOTION_CODE_EXISTS);
        Promotion promotion = new Promotion();
        /// Promotion mới luôn là DRAFT, chỉ được sử dụng sau khi Admin kích hoạt.
        promotion.setStatus(PromotionStatus.DRAFT);
        promotionValidator.validateEditableFields(request);
        applyEditableFields(promotion, request);
        Promotion saved = promotionRepository.save(promotion);
        audit(saved, "CREATED");
        return response(saved);
    }

    @Transactional
    public PromotionResponse updateDraft(UUID id, PromotionUpsertRequest request) {
        /// Chỉ cho sửa rule/target khi DRAFT để không làm thay đổi ý nghĩa promotion đang chạy.
        Promotion promotion = required(id);
        if (promotion.getStatus() != PromotionStatus.DRAFT)
            throw new AppException(PromotionErrorCode.PROMOTION_NOT_DRAFT);
        String code = normalize(request.code());
        if (!promotion.getCode().equalsIgnoreCase(code) && promotionRepository.existsByCodeIgnoreCase(code)) {
            throw new AppException(PromotionErrorCode.PROMOTION_CODE_EXISTS);
        }
        promotionValidator.validateEditableFields(request);
        // Xóa target cũ và flush trước để unique index không bị đụng khi target mới có cùng movie/showtime.
        promotion.replaceTargets(List.of());
        promotionRepository.flush();
        applyEditableFields(promotion, request);
        audit(promotion, "DRAFT_UPDATED");
        return response(promotion);
    }

    @Transactional
    public PromotionResponse activate(UUID id) {
        /// Promotion PAUSED có thể kích hoạt lại; ARCHIVED là trạng thái kết thúc.
        return transition(id, PromotionStatus.ACTIVE, "ACTIVATED", PromotionStatus.DRAFT, PromotionStatus.PAUSED);
    }

    @Transactional
    public PromotionResponse pause(UUID id) {
        return transition(id, PromotionStatus.PAUSED, "PAUSED", PromotionStatus.ACTIVE);
    }

    @Transactional
    public PromotionResponse retire(UUID id) {
        return transition(id, PromotionStatus.ARCHIVED, "RETIRED", PromotionStatus.DRAFT, PromotionStatus.ACTIVE, PromotionStatus.PAUSED);
    }

    @Transactional
    public PromotionResponse get(UUID id) {
        return response(required(id));
    }

    @Transactional
    public PromotionPageResponse search(PromotionStatus status, String query, Pageable pageable) {
        // Bind an empty String instead of null. PostgreSQL cannot infer the SQL
        // type of a null parameter used by lower/concat and treats it as bytea.
        String normalizedQuery = query == null ? "" : query.trim();
        Page<PromotionSummaryResponse> page = promotionRepository
                .searchAdmin(status, normalizedQuery, pageable)
                .map(this::summaryResponse);

        Map<PromotionStatus, Long> countsByStatus = promotionRepository.countByStatus().stream()
                .collect(java.util.stream.Collectors.toMap(
                        PromotionRepository.StatusCount::getStatus,
                        PromotionRepository.StatusCount::getTotal
                ));
        long active = countsByStatus.getOrDefault(PromotionStatus.ACTIVE, 0L);
        long draft = countsByStatus.getOrDefault(PromotionStatus.DRAFT, 0L);
        long paused = countsByStatus.getOrDefault(PromotionStatus.PAUSED, 0L);
        long archived = countsByStatus.getOrDefault(PromotionStatus.ARCHIVED, 0L);

        return new PromotionPageResponse(
                page.getContent(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.getNumber(),
                page.getSize(),
                new PromotionPageResponse.PromotionCounts(
                        active + draft + paused + archived,
                        active,
                        draft,
                        paused,
                        archived
                )
        );
    }

    private PromotionResponse transition(UUID id, PromotionStatus next, String action, PromotionStatus... allowed) {
        /// Gom mọi chuyển trạng thái vào một chỗ để controller không bỏ qua validation hoặc audit.
        Promotion promotion = required(id);
        boolean valid = java.util.Arrays.stream(allowed).anyMatch(status -> status == promotion.getStatus());
        if (!valid) throw new AppException(PromotionErrorCode.PROMOTION_INVALID_TRANSITION);
        promotion.setStatus(next);
        audit(promotion, action);
        return response(promotion);
    }

    private void applyEditableFields(Promotion promotion, PromotionUpsertRequest request) {
        /// Validate nghiệp vụ trước khi database constraint phải chặn dữ liệu không hợp lệ.
        promotion.setCode(normalize(request.code()));
        promotion.setName(request.name().trim());
        promotion.setDescription(request.description());
        promotion.setBenefitScope(request.benefitScope());
        promotion.setValidFrom(request.validFrom());
        promotion.setValidUntil(request.validUntil());
        promotion.setGlobalUsageLimit(request.globalUsageLimit());
        promotion.setPerAccountUsageLimit(request.perAccountUsageLimit());
        /// Cascade + orphanRemoval thay rule/target của DRAFT cùng lúc khi lưu promotion.
        applyPriceRule(promotion, request.priceRule());
        promotion.replaceTargets(toTargets(request.targets()));
    }

    private void applyPriceRule(Promotion promotion, PromotionPriceRuleRequest request) {
        /// Một rule chỉ được là giảm phần trăm HOẶC giảm tiền cố định, không được đồng thời cả hai.
        PromotionPriceRule rule = promotion.getPriceRule();
        if (rule == null) {
            rule = new PromotionPriceRule();
            promotion.replacePriceRule(rule);
        }
        rule.setDiscountType(request.discountType());
        rule.setPercentage(request.percentage());
        rule.setFixedAmount(request.fixedAmount());
        rule.setMaxDiscountAmount(request.maxDiscountAmount());
        rule.setMinimumOrderAmount(request.minimumOrderAmount() == null ? BigDecimal.ZERO : request.minimumOrderAmount());
        rule.setCurrency(request.currency() == null ? "VND" : request.currency().trim().toUpperCase());
    }

    private List<PromotionTarget> toTargets(List<PromotionTargetRequest> requests) {
        /// Không có target nghĩa là promotion chủ đích áp dụng cho mọi movie/showtime.
        if (requests == null) return List.of();
        List<PromotionTarget> result = new ArrayList<>();
        for (PromotionTargetRequest request : requests) {
            // Mỗi target row chỉ trỏ tới một domain; SQL CHECK constraint cũng kiểm tra lại điều này.
            PromotionTarget target = new PromotionTarget();
            target.setTargetType(request.targetType());
            target.setMovieId(request.movieId());
            target.setShowtimeId(request.showtimeId());
            result.add(target);
        }
        return result;
    }

    private Promotion required(UUID id) {
        return promotionRepository.findById(id).orElseThrow(() -> new AppException(PromotionErrorCode.PROMOTION_NOT_FOUND));
    }

    private void audit(Promotion promotion, String action) {
        /// Audit là append-only. Actor lấy từ JWT đã xác thực, không tin dữ liệu client gửi lên.
        PromotionAuditLog log = new PromotionAuditLog();
        log.setPromotion(promotion);
        log.setAction(action);
        log.setActorAccountId(JwtSecurityUtils.getCurrentAccountId());
        log.setDetail(Map.of("status", promotion.getStatus().name()));
        auditLogRepository.save(log);
    }

    private PromotionResponse response(Promotion p) {
        /// Response trả model cho màn hình Admin, không trả trực tiếp JPA entity ra API.
        PromotionPriceRule r = p.getPriceRule();
        List<PromotionResponse.AuditEntry> auditLog = auditLogRepository
                .findTop20ByPromotion_PromotionIdOrderByCreatedAtDesc(p.getPromotionId()).stream()
                .map(log -> new PromotionResponse.AuditEntry(log.getAction(), log.getActorAccountId(), log.getCreatedAt()))
                .toList();
        return new PromotionResponse(p.getPromotionId(), p.getCode(), p.getName(), p.getDescription(), p.getStatus(), p.getBenefitScope(), p.getValidFrom(), p.getValidUntil(), p.getGlobalUsageLimit(), p.getPerAccountUsageLimit(), p.getVersion(), p.getActiveReservationCount(), p.getCommittedUsageCount(), new PromotionResponse.PriceRule(r.getDiscountType(), r.getPercentage(), r.getFixedAmount(), r.getMaxDiscountAmount(), r.getMinimumOrderAmount(), r.getCurrency()), p.getTargets().stream().map(t -> new PromotionResponse.Target(t.getTargetType(), t.getMovieId(), t.getShowtimeId())).toList(), auditLog);
    }

    private PromotionSummaryResponse summaryResponse(Promotion promotion) {
        PromotionPriceRule rule = promotion.getPriceRule();
        return new PromotionSummaryResponse(
                promotion.getPromotionId(),
                promotion.getCode(),
                promotion.getName(),
                promotion.getStatus(),
                promotion.getBenefitScope(),
                promotion.getValidFrom(),
                promotion.getValidUntil(),
                new PromotionSummaryResponse.PriceRuleSummary(
                        rule.getDiscountType(),
                        rule.getPercentage(),
                        rule.getFixedAmount(),
                        rule.getMinimumOrderAmount(),
                        rule.getCurrency()
                )
        );
    }

    private String normalize(String code) {
        return code.trim().toUpperCase();
    }

}
