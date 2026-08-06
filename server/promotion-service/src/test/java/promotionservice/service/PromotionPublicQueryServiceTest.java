package promotionservice.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import promotionservice.entity.Promotion;
import promotionservice.entity.PromotionPriceRule;
import promotionservice.enums.DiscountType;
import promotionservice.enums.PromotionBenefitScope;
import promotionservice.enums.PromotionStatus;
import promotionservice.repository.PromotionRepository;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PromotionPublicQueryServiceTest {
    @Mock
    private PromotionRepository promotionRepository;

    @InjectMocks
    private PromotionPublicQueryService service;

    @Test
    void exposesOnlyEffectiveOffersWithRemainingQuota() {
        Promotion active = promotion("PUBLIC20", OffsetDateTime.now().plusDays(2), 10, 2);
        Promotion expired = promotion("EXPIRED", OffsetDateTime.now().minusMinutes(1), 10, 0);
        Promotion exhausted = promotion("USEDUP", OffsetDateTime.now().plusDays(2), 2, 2);
        when(promotionRepository.findByStatusOrderByValidUntilAsc(PromotionStatus.ACTIVE))
                .thenReturn(List.of(active, expired, exhausted));

        var result = service.activeOffers();

        assertThat(result).singleElement().satisfies(offer -> {
            assertThat(offer.code()).isEqualTo("PUBLIC20");
            assertThat(offer.discountType()).isEqualTo(DiscountType.PERCENTAGE);
            assertThat(offer.percentage()).isEqualByComparingTo("20");
        });
    }

    private Promotion promotion(String code, OffsetDateTime validUntil, int limit, int committed) {
        Promotion promotion = new Promotion();
        promotion.setPromotionId(UUID.randomUUID());
        promotion.setCode(code);
        promotion.setName(code);
        promotion.setDescription("Public offer");
        promotion.setStatus(PromotionStatus.ACTIVE);
        promotion.setBenefitScope(PromotionBenefitScope.ORDER);
        promotion.setValidFrom(OffsetDateTime.now().minusDays(1));
        promotion.setValidUntil(validUntil);
        promotion.setGlobalUsageLimit(limit);
        promotion.setCommittedUsageCount(committed);

        PromotionPriceRule rule = new PromotionPriceRule();
        rule.setDiscountType(DiscountType.PERCENTAGE);
        rule.setPercentage(BigDecimal.valueOf(20));
        rule.setMinimumOrderAmount(BigDecimal.ZERO);
        rule.setCurrency("VND");
        promotion.replacePriceRule(rule);
        return promotion;
    }
}
