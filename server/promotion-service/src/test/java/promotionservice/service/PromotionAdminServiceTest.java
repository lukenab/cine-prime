package promotionservice.service;

import movie.theater.common.exception.AppException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import promotionservice.dto.request.PromotionPriceRuleRequest;
import promotionservice.dto.request.PromotionTargetRequest;
import promotionservice.dto.request.PromotionUpsertRequest;
import promotionservice.entity.Promotion;
import promotionservice.entity.PromotionPriceRule;
import promotionservice.entity.PromotionTarget;
import promotionservice.enums.DiscountType;
import promotionservice.enums.PromotionStatus;
import promotionservice.enums.PromotionTargetType;
import promotionservice.repository.PromotionAuditLogRepository;
import promotionservice.repository.PromotionRepository;
import promotionservice.validation.PromotionValidator;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PromotionAdminServiceTest {
    @Mock PromotionRepository promotionRepository;
    @Mock PromotionAuditLogRepository auditLogRepository;
    @Spy PromotionValidator promotionValidator = new PromotionValidator();
    @InjectMocks PromotionAdminService service;

    @Test
    void updateDraftFlushesOldTargetAndReusesExistingPriceRule() {
        UUID id = UUID.randomUUID();
        Promotion promotion = draftPromotion();
        PromotionPriceRule existingRule = promotion.getPriceRule();
        when(promotionRepository.findById(id)).thenReturn(Optional.of(promotion));

        service.updateDraft(id, request("summer26", 30, 12L));

        verify(promotionRepository).flush();
        verify(auditLogRepository).save(any());
        assertSame(existingRule, promotion.getPriceRule());
        assertEquals(new BigDecimal("30"), promotion.getPriceRule().getPercentage());
        assertEquals(1, promotion.getTargets().size());
        assertEquals(12L, promotion.getTargets().getFirst().getMovieId());
    }

    @Test
    void createNormalizesCodeAndStartsAsDraft() {
        when(promotionRepository.existsByCodeIgnoreCase("SUMMER26")).thenReturn(false);
        when(promotionRepository.save(any(Promotion.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.create(request(" summer26 ", 20, 12L));

        verify(promotionRepository).save(any(Promotion.class));
        // Kiểm tra entity đã lưu qua argument để giữ test độc lập với UUID do database sinh.
        var captor = org.mockito.ArgumentCaptor.forClass(Promotion.class);
        verify(promotionRepository).save(captor.capture());
        assertEquals("SUMMER26", captor.getValue().getCode());
        assertEquals(PromotionStatus.DRAFT, captor.getValue().getStatus());
    }

    @Test
    void rejectsActivateWhenAlreadyActive() {
        UUID id = UUID.randomUUID();
        Promotion promotion = draftPromotion();
        promotion.setStatus(PromotionStatus.ACTIVE);
        when(promotionRepository.findById(id)).thenReturn(Optional.of(promotion));

        assertThrows(AppException.class, () -> service.activate(id));
        verifyNoInteractions(auditLogRepository);
    }

    private Promotion draftPromotion() {
        Promotion promotion = new Promotion();
        promotion.setCode("SUMMER26");
        promotion.setName("Summer");
        promotion.setStatus(PromotionStatus.DRAFT);
        PromotionPriceRule rule = new PromotionPriceRule();
        rule.setDiscountType(DiscountType.PERCENTAGE);
        rule.setPercentage(new BigDecimal("20"));
        rule.setMinimumOrderAmount(BigDecimal.ZERO);
        rule.setCurrency("VND");
        promotion.replacePriceRule(rule);
        PromotionTarget target = new PromotionTarget();
        target.setTargetType(PromotionTargetType.MOVIE);
        target.setMovieId(12L);
        promotion.replaceTargets(List.of(target));
        return promotion;
    }

    private PromotionUpsertRequest request(String code, int percentage, long movieId) {
        return new PromotionUpsertRequest(code, "Summer updated", null, null, null, 100, 1,
                new PromotionPriceRuleRequest(DiscountType.PERCENTAGE, BigDecimal.valueOf(percentage), null,
                        new BigDecimal("50000"), new BigDecimal("100000"), "VND"),
                List.of(new PromotionTargetRequest(PromotionTargetType.MOVIE, movieId, null)));
    }
}
