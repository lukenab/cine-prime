package promotionservice.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.Test;
import org.hibernate.SessionFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import promotionservice.dto.request.PromotionPriceRuleRequest;
import promotionservice.dto.request.PromotionQuoteRequest;
import promotionservice.dto.request.PromotionReserveRequest;
import promotionservice.entity.Promotion;
import promotionservice.entity.PromotionPriceRule;
import promotionservice.enums.DiscountType;
import promotionservice.enums.PromotionStatus;
import promotionservice.repository.PromotionRepository;
import promotionservice.repository.PromotionReservationRepository;
import promotionservice.repository.PromotionUsageLedgerRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "eureka.client.enabled=false",
        "spring.jpa.properties.hibernate.generate_statistics=true"
})
class PromotionEligibilityConcurrencyIntegrationTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl); r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
    }
    @Autowired PromotionEligibilityService service;
    @Autowired PromotionAdminService adminService;
    @Autowired PromotionRepository promotions;
    @Autowired PromotionReservationRepository reservations;
    @Autowired PromotionUsageLedgerRepository ledgers;
    @Autowired EntityManager entityManager;
    @Autowired EntityManagerFactory entityManagerFactory;

    @Test void concurrentReserveNeverExceedsGlobalQuota() throws Exception {
        Promotion promotion = new Promotion(); promotion.setCode("RACE1"); promotion.setName("Race"); promotion.setStatus(PromotionStatus.ACTIVE); promotion.setGlobalUsageLimit(1);
        PromotionPriceRule rule = new PromotionPriceRule(); rule.setDiscountType(DiscountType.FIXED_AMOUNT); rule.setFixedAmount(BigDecimal.TEN); rule.setMinimumOrderAmount(BigDecimal.ZERO); rule.setCurrency("VND"); promotion.replacePriceRule(rule);
        promotions.saveAndFlush(promotion);
        ExecutorService pool = Executors.newFixedThreadPool(6); CountDownLatch ready = new CountDownLatch(6); CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> futures = java.util.stream.IntStream.range(0, 6).mapToObj(i -> pool.submit(() -> { ready.countDown(); start.await(); try {
            service.reserve(new PromotionReserveRequest("race-" + i, new PromotionQuoteRequest("RACE1", "booking-" + i, "account-" + i, null, null, null, BigDecimal.valueOf(100), BigDecimal.ZERO, BigDecimal.ZERO, "VND"))); return true;
        } catch (RuntimeException ignored) { return false; }})).toList();
        ready.await(10, TimeUnit.SECONDS); start.countDown(); int successes = 0; for (Future<Boolean> future : futures) if (future.get(10, TimeUnit.SECONDS)) successes++; pool.shutdown();
        assertEquals(1, successes); assertEquals(1, reservations.count());
    }

    @Test
    @Transactional
    void adminListUsesBoundedQueriesAndSupportsServerSideFiltering() {
        Promotion promotion = new Promotion();
        promotion.setCode("SEARCH-FAST");
        promotion.setName("Search optimized promotion");
        promotion.setStatus(PromotionStatus.ACTIVE);
        PromotionPriceRule rule = new PromotionPriceRule();
        rule.setDiscountType(DiscountType.FIXED_AMOUNT);
        rule.setFixedAmount(BigDecimal.TEN);
        rule.setMinimumOrderAmount(BigDecimal.ZERO);
        rule.setCurrency("VND");
        promotion.replacePriceRule(rule);
        promotions.saveAndFlush(promotion);

        entityManager.clear();
        SessionFactory sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);
        sessionFactory.getStatistics().clear();

        var result = adminService.search(
                PromotionStatus.ACTIVE,
                "optimized",
                org.springframework.data.domain.PageRequest.of(0, 20)
        );

        assertEquals(1, result.content().size());
        assertEquals("SEARCH-FAST", result.content().getFirst().code());
        assertTrue(sessionFactory.getStatistics().getPrepareStatementCount() <= 3,
                "Promotion list must use a bounded number of SQL statements");

        sessionFactory.getStatistics().clear();
        var unfilteredResult = adminService.search(
                null,
                null,
                org.springframework.data.domain.PageRequest.of(0, 20)
        );
        assertTrue(unfilteredResult.totalElements() > 0);
        assertTrue(sessionFactory.getStatistics().getPrepareStatementCount() <= 3,
                "Unfiltered promotion list must use a bounded number of SQL statements");
    }
}
