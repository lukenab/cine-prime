package movieservice.service;

import movieservice.dto.request.CinemaClusterRequest;
import movieservice.dto.request.ClusterOperatingHourRequest;
import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaClusterOperatingHour;
import movieservice.enums.CinemaVenueType;
import movieservice.enums.ClusterStatus;
import movieservice.repository.CinemaClusterRepository;
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

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Regression test for a real bug reported in the admin UI: editing an existing cluster's
 * operating schedule and clicking Save Changes failed with a generic 409
 * "Data already exists or conflicts with an existing record." (GlobalErrorCode.DATA_INTEGRITY_VIOLATION).
 *
 * Root cause: CinemaClusterService.replaceOperatingHours() used to do
 * cluster.getOperatingHours().clear() then re-add 7 brand-new CinemaClusterOperatingHour
 * entities. CinemaClusterOperatingHour uses GenerationType.IDENTITY, so Hibernate must
 * INSERT each newly-added row immediately - it cannot defer that to flush time. But the
 * orphan-removal DELETE for the cleared old rows only happens as part of the same flush's
 * entity-deletion phase, which runs *after* entity insertions in Hibernate's fixed action
 * order. So the new Monday row got INSERTed while the old Monday row was still present,
 * transiently violating uq_cluster_operating_day (cluster_id, day_of_week) - a real
 * Postgres constraint the mocked CinemaClusterServiceTest can never exercise, hence a real
 * Testcontainers-backed test here instead of a Mockito one.
 */
@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.flyway.enabled=false",
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false"
})
@Testcontainers(disabledWithoutDocker = true)
class CinemaClusterOperatingHoursUpdateIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("movie_service_cluster_hours_test")
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

    Long clusterId;

    @BeforeEach
    void setUp() {
        cinemaClusterRepository.deleteAll();

        CinemaCluster cluster = CinemaCluster.builder()
                .clusterCode("CP-014")
                .clusterName("CinePrime Vincom Plaza Imperia Hai Phong")
                .venueType(CinemaVenueType.MALL)
                .countryCode("VN")
                .province("Hai Phong")
                .address("1 Test Street, Hai Phong")
                .timezone("Asia/Ho_Chi_Minh")
                .status(ClusterStatus.ACTIVE)
                .createdBy("admin.one")
                .build();

        for (DayOfWeek day : DayOfWeek.values()) {
            CinemaClusterOperatingHour hour = CinemaClusterOperatingHour.builder()
                    .cluster(cluster)
                    .dayOfWeek(day)
                    .opensAt(LocalTime.of(8, 0))
                    .closesAt(LocalTime.of(23, 0))
                    .closesNextDay(false)
                    .closed(false)
                    .build();
            cluster.getOperatingHours().add(hour);
        }

        clusterId = cinemaClusterRepository.saveAndFlush(cluster).getClusterId();
    }

    @Test
    void updatingScheduleForEveryDayDoesNotViolateUniqueDayConstraint() {
        CinemaClusterRequest request = CinemaClusterRequest.builder()
                .clusterCode("CP-014")
                .clusterName("CinePrime Vincom Plaza Imperia Hai Phong")
                .venueType(CinemaVenueType.MALL)
                .countryCode("VN")
                .province("Hai Phong")
                .address("1 Test Street, Hai Phong")
                .timezone("Asia/Ho_Chi_Minh")
                .status(ClusterStatus.ACTIVE)
                .operatingHours(newScheduleAllDays(LocalTime.of(9, 0), LocalTime.of(22, 0)))
                .build();

        assertDoesNotThrow(() -> cinemaClusterService.updateCluster(clusterId, request, adminAuth()));

        CinemaCluster reloaded = cinemaClusterRepository.findById(clusterId).orElseThrow();
        assertEquals(7, reloaded.getOperatingHours().size());
        assertTrue(reloaded.getOperatingHours().stream()
                .allMatch(h -> h.getOpensAt().equals(LocalTime.of(9, 0)) && h.getClosesAt().equals(LocalTime.of(22, 0))));
    }

    private List<ClusterOperatingHourRequest> newScheduleAllDays(LocalTime opensAt, LocalTime closesAt) {
        List<ClusterOperatingHourRequest> hours = new ArrayList<>();
        for (DayOfWeek day : Arrays.asList(DayOfWeek.values())) {
            hours.add(ClusterOperatingHourRequest.builder()
                    .dayOfWeek(day)
                    .opensAt(opensAt)
                    .closesAt(closesAt)
                    .closesNextDay(false)
                    .closed(false)
                    .build());
        }
        return hours;
    }

    private UsernamePasswordAuthenticationToken adminAuth() {
        return new UsernamePasswordAuthenticationToken(
                "admin.one", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }
}
