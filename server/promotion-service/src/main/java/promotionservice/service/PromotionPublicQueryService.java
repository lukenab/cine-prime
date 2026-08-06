package promotionservice.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import promotionservice.dto.response.PublicPromotionOfferResponse;
import promotionservice.entity.Promotion;
import promotionservice.entity.PromotionPriceRule;
import promotionservice.enums.PromotionStatus;
import promotionservice.repository.PromotionRepository;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PromotionPublicQueryService {
    private final PromotionRepository promotionRepository;

    @Transactional(readOnly = true)
    public List<PublicPromotionOfferResponse> activeOffers() {
        OffsetDateTime now = OffsetDateTime.now();
        return promotionRepository.findByStatusOrderByValidUntilAsc(PromotionStatus.ACTIVE).stream()
                .filter(promotion -> isEffective(promotion, now))
                .filter(this::hasQuota)
                .map(this::response)
                .toList();
    }

    private boolean isEffective(Promotion promotion, OffsetDateTime now) {
        return (promotion.getValidFrom() == null || !now.isBefore(promotion.getValidFrom()))
                && (promotion.getValidUntil() == null || now.isBefore(promotion.getValidUntil()));
    }

    private boolean hasQuota(Promotion promotion) {
        return promotion.getGlobalUsageLimit() == null
                || promotion.getActiveReservationCount() + promotion.getCommittedUsageCount()
                < promotion.getGlobalUsageLimit();
    }

    private PublicPromotionOfferResponse response(Promotion promotion) {
        PromotionPriceRule rule = promotion.getPriceRule();
        return new PublicPromotionOfferResponse(
                promotion.getPromotionId(),
                promotion.getCode(),
                promotion.getName(),
                promotion.getDescription(),
                promotion.getBenefitScope(),
                promotion.getValidFrom(),
                promotion.getValidUntil(),
                rule.getDiscountType(),
                rule.getPercentage(),
                rule.getFixedAmount(),
                rule.getMaxDiscountAmount(),
                rule.getMinimumOrderAmount(),
                rule.getCurrency()
        );
    }
}
