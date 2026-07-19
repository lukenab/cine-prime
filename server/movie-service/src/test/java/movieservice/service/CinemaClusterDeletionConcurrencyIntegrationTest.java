package movieservice.service;

import movieservice.entity.CinemaCluster;
import movieservice.enums.CinemaVenueType;
import movieservice.enums.ClusterAction;
import movieservice.enums.ClusterStatus;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.ClusterAuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.flyway.enabled=false",
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false"
})
@Testcontainers(disabledWithoutDocker = true)
class CinemaClusterDeletionConcurrencyIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("movie_service_cluster_delete_test")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired CinemaClusterService cinemaClusterService;
    @Autowired CinemaClusterRepository cinemaClusterRepository;
    @Autowired ClusterAuditLogRepository clusterAuditLogRepository;

    Long clusterId;

    @BeforeEach
    void setUp() {
        clusterAuditLogRepository.deleteAll();
        cinemaClusterRepository.deleteAll();

        CinemaCluster cluster = CinemaCluster.builder()
                .clusterCode("CP-RACE")
                .clusterName("Delete race cluster")
                .venueType(CinemaVenueType.MALL)
                .countryCode("VN")
                .province("Ho Chi Minh City")
                .address("1 Test Street")
                .timezone("Asia/Ho_Chi_Minh")
                .status(ClusterStatus.DRAFT)
                .createdBy("employee.one")
                .build();
        clusterId = cinemaClusterRepository.saveAndFlush(cluster).getClusterId();
    }

    @Test
    void deleteRacingSubmitAllowsExactlyOneLifecycleCommandToWin() throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Boolean> delete = executor.submit(() -> runDelete(ready, start));
            Future<Boolean> submit = executor.submit(() -> runSubmit(ready, start));

            ready.await();
            start.countDown();

            assertEquals(1, (delete.get() ? 1 : 0) + (submit.get() ? 1 : 0));
        }

        if (cinemaClusterRepository.existsById(clusterId)) {
            assertEquals(ClusterStatus.PENDING_REVIEW,
                    cinemaClusterRepository.findById(clusterId).orElseThrow().getStatus());
        } else {
            assertTrue(clusterAuditLogRepository.existsByClusterIdAndActionIn(
                    clusterId, List.of(ClusterAction.DELETE)));
        }
    }

    private boolean runDelete(CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        try {
            cinemaClusterService.deleteUnusedDraft(clusterId, authentication("admin.one", "ROLE_ADMIN"));
            return true;
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private boolean runSubmit(CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        try {
            cinemaClusterService.submitCluster(clusterId, authentication("employee.one", "ROLE_EMPLOYEE"));
            return true;
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private UsernamePasswordAuthenticationToken authentication(String actor, String role) {
        return new UsernamePasswordAuthenticationToken(
                actor, "n/a", List.of(new SimpleGrantedAuthority(role)));
    }
}
