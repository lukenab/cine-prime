package promotionservice.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
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

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = "eureka.client.enabled=false")
class PromotionEligibilityConcurrencyIntegrationTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl); r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
    }
    @Autowired PromotionEligibilityService service;
    @Autowired PromotionRepository promotions;
    @Autowired PromotionReservationRepository reservations;
    @Autowired PromotionUsageLedgerRepository ledgers;

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
}
