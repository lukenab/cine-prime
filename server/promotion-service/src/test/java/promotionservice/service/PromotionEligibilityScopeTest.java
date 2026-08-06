package promotionservice.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import promotionservice.dto.request.PromotionQuoteRequest;
import promotionservice.dto.response.PromotionQuoteResponse;
import promotionservice.entity.Promotion;
import promotionservice.entity.PromotionPriceRule;
import promotionservice.enums.DiscountType;
import promotionservice.enums.PromotionBenefitScope;
import promotionservice.enums.PromotionStatus;
import promotionservice.repository.PromotionRepository;
import promotionservice.repository.PromotionReservationRepository;
import promotionservice.repository.PromotionUsageLedgerRepository;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PromotionEligibilityScopeTest {
    private PromotionRepository promotions;
    private PromotionEligibilityService service;

    @BeforeEach
    void setUp() {
        promotions = mock(PromotionRepository.class);
        service = new PromotionEligibilityService(
                promotions,
                mock(PromotionReservationRepository.class),
                mock(PromotionUsageLedgerRepository.class));
    }

    @Test
    void orderScopeUsesTicketsAndConcessionsButExcludesServiceFee() {
        Promotion promotion = percentagePromotion(PromotionBenefitScope.ORDER);
        when(promotions.findByCodeIgnoreCase("ORDER10")).thenReturn(Optional.of(promotion));

        PromotionQuoteResponse quote = service.quote(new PromotionQuoteRequest(
                "ORDER10", "booking-1", "account-1", 1L, 2L, 3L,
                new BigDecimal("100000"), new BigDecimal("50000"),
                new BigDecimal("10000"), "VND"));

        assertTrue(quote.eligible());
        assertEquals(new BigDecimal("150000"), quote.subtotalAmount());
        assertEquals(new BigDecimal("15000"), quote.discountAmount());
        assertEquals(PromotionBenefitScope.ORDER, quote.benefitScope());
    }

    @Test
    void concessionScopeRejectsAnOrderWithoutConcessions() {
        Promotion promotion = percentagePromotion(PromotionBenefitScope.CONCESSIONS);
        promotion.getPriceRule().setMinimumOrderAmount(BigDecimal.ONE);
        when(promotions.findByCodeIgnoreCase("ORDER10")).thenReturn(Optional.of(promotion));

        PromotionQuoteResponse quote = service.quote(new PromotionQuoteRequest(
                "ORDER10", "booking-1", "account-1", 1L, 2L, 3L,
                new BigDecimal("100000"), BigDecimal.ZERO, BigDecimal.ZERO, "VND"));

        assertEquals(false, quote.eligible());
    }

    private Promotion percentagePromotion(PromotionBenefitScope scope) {
        Promotion promotion = new Promotion();
        promotion.setCode("ORDER10");
        promotion.setName("Order 10");
        promotion.setStatus(PromotionStatus.ACTIVE);
        promotion.setBenefitScope(scope);
        PromotionPriceRule rule = new PromotionPriceRule();
        rule.setDiscountType(DiscountType.PERCENTAGE);
        rule.setPercentage(BigDecimal.TEN);
        rule.setMinimumOrderAmount(BigDecimal.ZERO);
        rule.setCurrency("VND");
        promotion.replacePriceRule(rule);
        return promotion;
    }
}
