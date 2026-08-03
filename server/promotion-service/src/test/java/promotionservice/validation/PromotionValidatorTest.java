package promotionservice.validation;

import movie.theater.common.exception.AppException;
import org.junit.jupiter.api.Test;
import promotionservice.dto.request.PromotionPriceRuleRequest;
import promotionservice.dto.request.PromotionTargetRequest;
import promotionservice.dto.request.PromotionUpsertRequest;
import promotionservice.enums.DiscountType;
import promotionservice.enums.PromotionTargetType;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PromotionValidatorTest {
    private final PromotionValidator validator = new PromotionValidator();

    @Test
    void acceptsValidMoviePercentagePromotion() {
        assertDoesNotThrow(() -> validator.validateEditableFields(validRequest()));
    }

    @Test
    void rejectsInvalidValidityWindow() {
        PromotionUpsertRequest request = new PromotionUpsertRequest("SUMMER", "Summer", null,
                OffsetDateTime.parse("2026-09-01T00:00:00Z"), OffsetDateTime.parse("2026-08-01T00:00:00Z"),
                null, null, validRule(), List.of());
        assertThrows(AppException.class, () -> validator.validateEditableFields(request));
    }

    @Test
    void rejectsPercentageAboveOneHundred() {
        PromotionPriceRuleRequest rule = new PromotionPriceRuleRequest(DiscountType.PERCENTAGE,
                new BigDecimal("100.01"), null, null, BigDecimal.ZERO, "VND");
        PromotionUpsertRequest request = new PromotionUpsertRequest("SUMMER", "Summer", null,
                null, null, null, null, rule, List.of());
        assertThrows(AppException.class, () -> validator.validateEditableFields(request));
    }

    @Test
    void rejectsTargetContainingMovieAndShowtime() {
        PromotionUpsertRequest request = new PromotionUpsertRequest("SUMMER", "Summer", null,
                null, null, null, null, validRule(),
                List.of(new PromotionTargetRequest(PromotionTargetType.MOVIE, 12L, 55L)));
        assertThrows(AppException.class, () -> validator.validateEditableFields(request));
    }

    private PromotionUpsertRequest validRequest() {
        return new PromotionUpsertRequest("SUMMER", "Summer", null, null, null, 10, 1, validRule(),
                List.of(new PromotionTargetRequest(PromotionTargetType.MOVIE, 12L, null)));
    }

    private PromotionPriceRuleRequest validRule() {
        return new PromotionPriceRuleRequest(DiscountType.PERCENTAGE, new BigDecimal("20"),
                null, new BigDecimal("50000"), new BigDecimal("100000"), "VND");
    }
}
