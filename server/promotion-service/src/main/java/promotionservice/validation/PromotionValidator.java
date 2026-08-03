package promotionservice.validation;

import movie.theater.common.exception.AppException;
import org.springframework.stereotype.Component;
import promotionservice.dto.request.PromotionPriceRuleRequest;
import promotionservice.dto.request.PromotionTargetRequest;
import promotionservice.dto.request.PromotionUpsertRequest;
import promotionservice.enums.DiscountType;
import promotionservice.enums.PromotionTargetType;
import promotionservice.exception.PromotionErrorCode;

import java.math.BigDecimal;
import java.util.List;

@Component
public class PromotionValidator {

    /** Kiểm tra toàn bộ dữ liệu Admin được phép thay đổi trên promotion DRAFT. */
    public void validateEditableFields(PromotionUpsertRequest request) {
        validateValidityWindow(request);
        validateUsageLimits(request);
        validatePriceRule(request.priceRule());
        validateTargets(request.targets());
    }

    private void validateValidityWindow(PromotionUpsertRequest request) {
        if (request.validFrom() != null && request.validUntil() != null
                && !request.validFrom().isBefore(request.validUntil())) {
            throw new AppException(PromotionErrorCode.PROMOTION_INVALID_WINDOW);
        }
    }

    private void validateUsageLimits(PromotionUpsertRequest request) {
        if (invalidLimit(request.globalUsageLimit()) || invalidLimit(request.perAccountUsageLimit())) {
            throw new AppException(PromotionErrorCode.PROMOTION_INVALID_RULE);
        }
    }

    private void validatePriceRule(PromotionPriceRuleRequest request) {
        if (request == null) {
            throw new AppException(PromotionErrorCode.PROMOTION_INVALID_RULE);
        }

        boolean percentage = request.discountType() == DiscountType.PERCENTAGE
                && positive(request.percentage())
                && request.percentage().compareTo(BigDecimal.valueOf(100)) <= 0
                && request.fixedAmount() == null;
        boolean fixedAmount = request.discountType() == DiscountType.FIXED_AMOUNT
                && positive(request.fixedAmount())
                && request.percentage() == null
                && request.maxDiscountAmount() == null;

        if ((!percentage && !fixedAmount)
                || negative(request.minimumOrderAmount())
                || !validCurrency(request.currency())) {
            throw new AppException(PromotionErrorCode.PROMOTION_INVALID_RULE);
        }
    }

    private void validateTargets(List<PromotionTargetRequest> targets) {
        if (targets == null) {
            return; // Không có target = promotion áp dụng toàn hệ thống.
        }

        for (PromotionTargetRequest target : targets) {
            boolean movieTarget = target != null
                    && target.targetType() == PromotionTargetType.MOVIE
                    && target.movieId() != null
                    && target.showtimeId() == null;
            boolean showtimeTarget = target != null
                    && target.targetType() == PromotionTargetType.SHOWTIME
                    && target.showtimeId() != null
                    && target.movieId() == null;
            if (!movieTarget && !showtimeTarget) {
                throw new AppException(PromotionErrorCode.PROMOTION_INVALID_TARGET);
            }
        }
    }

    private boolean positive(BigDecimal value) {
        return value != null && value.signum() > 0;
    }

    private boolean negative(BigDecimal value) {
        return value != null && value.signum() < 0;
    }

    private boolean invalidLimit(Integer value) {
        return value != null && value <= 0;
    }

    private boolean validCurrency(String value) {
        return value == null || value.trim().matches("[A-Za-z]{3}");
    }
}
