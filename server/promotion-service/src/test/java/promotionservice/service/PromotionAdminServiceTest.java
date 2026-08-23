package promotionservice.service;

import movie.theater.common.exception.AppException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import promotionservice.dto.request.PromotionPriceRuleRequest;
import promotionservice.dto.request.PromotionTargetRequest;
import promotionservice.dto.request.PromotionUpsertRequest;
import promotionservice.entity.Promotion;
import promotionservice.entity.PromotionPriceRule;
import promotionservice.entity.PromotionTarget;
import promotionservice.entity.PromotionAuditLog;
import promotionservice.enums.DiscountType;
import promotionservice.enums.PromotionStatus;
import promotionservice.enums.PromotionTargetType;
import promotionservice.enums.PromotionBenefitScope;
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

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

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

    @Test
    void submitAndApproveRequireDifferentAccounts() {
        UUID id = UUID.randomUUID();
        Promotion promotion = draftPromotion();
        when(promotionRepository.findById(id)).thenReturn(Optional.of(promotion));

        authenticate("commercial-maker");
        service.submit(id, "Ready for commercial review");
        assertEquals(PromotionStatus.PENDING_APPROVAL, promotion.getStatus());
        assertEquals("commercial-maker", promotion.getSubmittedByAccountId());

        assertThrows(AppException.class, () -> service.approve(id, "Self approval"));
        assertEquals(PromotionStatus.PENDING_APPROVAL, promotion.getStatus());

        authenticate("commercial-checker");
        service.approve(id, "Budget verified");
        assertEquals(PromotionStatus.APPROVED, promotion.getStatus());
        assertEquals("commercial-checker", promotion.getApprovedByAccountId());
    }

    @Test
    void pauseRequiresReasonAndPersistsItInAuditDetail() {
        UUID id = UUID.randomUUID();
        Promotion promotion = draftPromotion();
        promotion.setStatus(PromotionStatus.ACTIVE);
        when(promotionRepository.findById(id)).thenReturn(Optional.of(promotion));

        assertThrows(AppException.class, () -> service.pause(id, " "));

        service.pause(id, "Incorrect campaign configuration");

        var captor = org.mockito.ArgumentCaptor.forClass(PromotionAuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        assertEquals(PromotionStatus.PAUSED, promotion.getStatus());
        assertEquals("Incorrect campaign configuration", captor.getValue().getDetail().get("reason"));
        assertEquals("ACTIVE", captor.getValue().getDetail().get("fromStatus"));
        assertEquals("PAUSED", captor.getValue().getDetail().get("toStatus"));
    }

    @Test
    void searchUsesSummaryQueryWithoutLoadingAuditHistory() {
        Promotion promotion = draftPromotion();
        var pageable = PageRequest.of(0, 20);
        PromotionRepository.StatusCount draftCount = mock(PromotionRepository.StatusCount.class);
        when(draftCount.getStatus()).thenReturn(PromotionStatus.DRAFT);
        when(draftCount.getTotal()).thenReturn(1L);
        when(promotionRepository.searchAdmin(PromotionStatus.DRAFT, "summer", pageable))
                .thenReturn(new PageImpl<>(List.of(promotion), pageable, 1));
        when(promotionRepository.countByStatus()).thenReturn(List.of(draftCount));

        var result = service.search(PromotionStatus.DRAFT, " summer ", pageable);

        assertEquals(1, result.content().size());
        assertEquals("SUMMER26", result.content().getFirst().code());
        assertEquals(1, result.counts().total());
        assertEquals(1, result.counts().draft());
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
        return new PromotionUpsertRequest(code, "Summer updated", null, PromotionBenefitScope.TICKETS, null, null, 100, 1,
                new PromotionPriceRuleRequest(DiscountType.PERCENTAGE, BigDecimal.valueOf(percentage), null,
                        new BigDecimal("50000"), new BigDecimal("100000"), "VND"),
                List.of(new PromotionTargetRequest(PromotionTargetType.MOVIE, movieId, null)));
    }

    private void authenticate(String accountId) {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .claim("accountId", accountId)
                .claim("role", "ROLE_COMMERCIAL_MANAGER")
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }
}
