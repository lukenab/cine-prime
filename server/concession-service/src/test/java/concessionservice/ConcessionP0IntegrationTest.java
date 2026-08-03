package concessionservice;

import concessionservice.dto.ConcessionModels.*;
import concessionservice.service.ConcessionService;
import movie.theater.common.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "eureka.client.enabled=false",
        "concession.reservation.expiry-delay-ms=600000"
})
class ConcessionP0IntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("concession_test")
                    .withUsername("postgres")
                    .withPassword("postgres");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    ConcessionService service;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void resetInventory() {
        jdbc.update("DELETE FROM concession_order_item");
        jdbc.update("DELETE FROM concession_order");
        jdbc.update("DELETE FROM concession_reservation_stock");
        jdbc.update("DELETE FROM concession_reservation_item");
        jdbc.update("DELETE FROM concession_reservation");
        jdbc.update("UPDATE cluster_inventory SET on_hand=100,reserved=0,version=version+1");
    }

    @Test
    void happyPath_reservesConfirmsAndCreatesPickupCode() {
        ReservationResponse reserved = service.reserve(request(
                "booking-happy", "idem-happy", 1, null));

        assertThat(reserved.status()).isEqualTo("RESERVED");
        assertThat(reserved.total()).isPositive();

        OrderResponse order = service.confirm(
                reserved.reservationId(),
                new ConfirmRequest("payment-happy", OffsetDateTime.now(ZoneOffset.UTC)));

        assertThat(order.status()).isEqualTo("PAID");
        assertThat(order.pickupCode()).startsWith("CP-");
        assertThat(order.items()).extracting(ReservationLineResponse::itemCode)
                .containsExactly("POP-CARAMEL-M");
    }

    @Test
    void duplicateRequest_replaysWithoutDoubleReservingStock() {
        ReservationRequest request = request("booking-retry", "idem-retry", 2, null);

        ReservationResponse first = service.reserve(request);
        ReservationResponse replay = service.reserve(request);

        assertThat(replay.reservationId()).isEqualTo(first.reservationId());
        assertThat(replay.replayed()).isTrue();
        InventoryResponse inventory = service.inventory(1L).stream()
                .filter(row -> row.skuId().equals(1L))
                .findFirst().orElseThrow();
        assertThat(inventory.reserved()).isEqualTo(2);
    }

    @Test
    void twoCustomersCompetingForLastItem_onlyOneReservationWins() throws Exception {
        service.setInventory(1L, 1L, new InventoryRequest(1));
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Boolean>> results = List.of(
                    pool.submit(() -> reserveAfter(start, "booking-race-a", "idem-race-a")),
                    pool.submit(() -> reserveAfter(start, "booking-race-b", "idem-race-b")));
            start.countDown();
            assertThat(results).extracting(this::futureValue)
                    .containsExactlyInAnyOrder(true, false);
            assertThat(service.inventory(1L).stream()
                    .filter(row -> row.skuId().equals(1L))
                    .findFirst().orElseThrow().reserved()).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void expiredHold_releasesReservedInventory() throws Exception {
        ReservationResponse reservation = service.reserve(request(
                "booking-expired", "idem-expired", 1,
                OffsetDateTime.now(ZoneOffset.UTC).plusNanos(150_000_000)));
        Thread.sleep(200);

        ReservationResponse released = service.release(reservation.reservationId(), true);

        assertThat(released.status()).isEqualTo("EXPIRED");
        assertThat(service.inventory(1L).stream()
                .filter(row -> row.skuId().equals(1L))
                .findFirst().orElseThrow().reserved()).isZero();
    }

    @Test
    void failedPayment_releaseCommandIsIdempotent() {
        ReservationResponse reservation = service.reserve(request(
                "booking-payment-failed", "idem-payment-failed", 3, null));

        ReservationResponse first = service.release(reservation.reservationId(), false);
        ReservationResponse replay = service.release(reservation.reservationId(), false);

        assertThat(first.status()).isEqualTo("RELEASED");
        assertThat(replay.status()).isEqualTo("RELEASED");
        assertThat(replay.replayed()).isTrue();
        assertThat(service.inventory(1L).stream()
                .filter(row -> row.skuId().equals(1L))
                .findFirst().orElseThrow().reserved()).isZero();
    }

    @Test
    void comboCatalog_exposesOptionStockAndAvailableSelectionCanBeReserved() {
        service.setInventory(1L, 4L, new InventoryRequest(0));

        CatalogItemResponse combo = service.catalog(1L).stream()
                .filter(item -> item.sellableType().equals("COMBO") && item.sellableId().equals(1L))
                .findFirst()
                .orElseThrow();

        assertThat(combo.availability()).isEqualTo("AVAILABLE");
        assertThat(combo.components())
                .filteredOn(component -> component.allowedSkuId().equals(4L))
                .singleElement()
                .extracting(ComboComponentResponse::availableCount)
                .isEqualTo(0);

        ReservationRequest unavailableChoice = new ReservationRequest(
                "booking-combo-unavailable",
                "customer-1",
                1L,
                List.of(new ReservationItemRequest(
                        "COMBO",
                        1L,
                        1,
                        List.of(
                                new SelectionRequest("POPCORN", List.of(2L)),
                                new SelectionRequest("DRINK", List.of(4L, 5L))))),
                "idem-combo-unavailable",
                null);
        assertThatThrownBy(() -> service.reserve(unavailableChoice))
                .isInstanceOf(AppException.class);

        ReservationResponse reserved = service.reserve(new ReservationRequest(
                "booking-combo-available",
                "customer-1",
                1L,
                List.of(new ReservationItemRequest(
                        "COMBO",
                        1L,
                        1,
                        List.of(
                                new SelectionRequest("POPCORN", List.of(2L)),
                                new SelectionRequest("DRINK", List.of(5L, 5L))))),
                "idem-combo-available",
                null));

        assertThat(reserved.status()).isEqualTo("RESERVED");
        assertThat(reserved.items()).singleElement()
                .satisfies(item -> assertThat(item.options()).containsIgnoringCase("7Up"));
    }

    @Test
    void phase2_bulkScheduleCopyAndAudit_areConsistent() {
        OffsetDateTime startsAt = OffsetDateTime.now(ZoneOffset.UTC)
                .plusDays(1)
                .truncatedTo(ChronoUnit.MICROS);
        OffsetDateTime endsAt = startsAt.plusDays(7);

        List<OfferResponse> bulk = service.bulkUpsertOffers(
                99L,
                new BulkOfferRequest(List.of(new OfferBulkItemRequest(
                        "SKU", 1L, new BigDecimal("65000"), "VND", true,
                        startsAt, endsAt))),
                "pricing-admin");

        assertThat(bulk).singleElement().satisfies(offer -> {
            assertThat(offer.price()).isEqualByComparingTo("65000");
            assertThat(offer.effectiveFrom()).isEqualTo(startsAt);
            assertThat(offer.effectiveTo()).isEqualTo(endsAt);
        });
        assertThat(service.offerAudit(99L, 10))
                .singleElement()
                .satisfies(audit -> {
                    assertThat(audit.operation()).isEqualTo("BULK_UPDATE");
                    assertThat(audit.changedBy()).isEqualTo("pricing-admin");
                });

        List<OfferResponse> copied = service.copyOffers(
                100L, new CopyOffersRequest(99L, false), "regional-admin");

        assertThat(copied).singleElement().satisfies(offer -> {
            assertThat(offer.cinemaClusterId()).isEqualTo(100L);
            assertThat(offer.price()).isEqualByComparingTo("65000");
        });
        assertThat(service.offerAudit(100L, 10))
                .singleElement()
                .satisfies(audit -> {
                    assertThat(audit.operation()).isEqualTo("COPY");
                    assertThat(audit.sourceClusterId()).isEqualTo(99L);
                    assertThat(audit.changedBy()).isEqualTo("regional-admin");
                });
    }

    @Test
    void branchManagerDraft_adminApprovalWorkflow_enforcesMakerCheckerStates() {
        ProductRequest request = new ProductRequest(
                "WORKFLOW-TEST",
                "Workflow Test Product",
                "SNACKS",
                "Created by a branch manager.",
                "https://example.com/workflow-test.webp",
                true);

        ProductResponse draft = service.createProduct(request, "branchmanager");
        assertThat(draft.status()).isEqualTo("DRAFT");
        assertThat(draft.active()).isFalse();
        assertThat(draft.createdBy()).isEqualTo("branchmanager");

        service.createSku(
                new SkuRequest(
                        draft.id(),
                        "WORKFLOW-TEST-REG",
                        "Regular",
                        null,
                        java.util.Map.of(),
                        true),
                "branchmanager",
                false);

        ProductResponse submitted = service.submitProduct(
                draft.id(), "branchmanager", false);
        assertThat(submitted.status()).isEqualTo("PENDING_APPROVAL");
        assertThat(submitted.submittedBy()).isEqualTo("branchmanager");

        assertThatThrownBy(() -> service.updateProduct(
                draft.id(), request, "another-manager", false))
                .isInstanceOf(AppException.class);

        ProductResponse rejected = service.rejectProduct(
                draft.id(), "Use a clearer customer-facing name.", "admin");
        assertThat(rejected.status()).isEqualTo("REJECTED");
        assertThat(rejected.rejectionReason()).contains("clearer");

        service.updateProduct(
                draft.id(),
                new ProductRequest(
                        request.code(),
                        "Improved Workflow Product",
                        request.category(),
                        request.description(),
                        request.imageUrl(),
                        false),
                "branchmanager",
                false);
        service.submitProduct(draft.id(), "branchmanager", false);

        ProductResponse approved = service.approveProduct(draft.id(), "admin");
        assertThat(approved.status()).isEqualTo("ACTIVE");
        assertThat(approved.active()).isTrue();
        assertThat(approved.reviewedBy()).isEqualTo("admin");
        assertThat(approved.rejectionReason()).isNull();
    }

    private boolean reserveAfter(CountDownLatch start, String bookingId, String key)
            throws InterruptedException {
        start.await();
        try {
            service.reserve(request(bookingId, key, 1, null));
            return true;
        } catch (AppException expected) {
            return false;
        }
    }

    private boolean futureValue(Future<Boolean> future) {
        try {
            return future.get(10, TimeUnit.SECONDS);
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }

    private ReservationRequest request(
            String bookingId,
            String idempotencyKey,
            int quantity,
            OffsetDateTime checkoutExpiry) {
        return new ReservationRequest(
                bookingId,
                "customer-1",
                1L,
                List.of(new ReservationItemRequest("SKU", 1L, quantity, List.of())),
                idempotencyKey,
                checkoutExpiry);
    }
}
