package movieservice.service;

import movieservice.dto.request.BulkShowTimeRequest;
import movieservice.dto.response.BulkShowTimeCreateResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.MovieStatus;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.ShowTimeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.flyway.enabled=false",
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false"
})
@Testcontainers(disabledWithoutDocker = true)
class BulkShowTimeConcurrencyIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("movie_service_bulk_test")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired ShowTimeService showTimeService;
    @Autowired ShowTimeRepository showTimeRepository;
    @Autowired MovieRepository movieRepository;
    @Autowired CinemaRoomRepository cinemaRoomRepository;

    Long movieId;
    Long roomId;

    @BeforeEach
    void setUp() {
        showTimeRepository.deleteAll();
        cinemaRoomRepository.deleteAll();
        movieRepository.deleteAll();

        Movie movie = new Movie();
        movie.setOriginalTitle("Concurrent Bulk Test");
        movie.setOriginalLanguage("en");
        movie.setDurationMinutes(90);
        movie.setStatus(MovieStatus.APPROVED);
        movieId = movieRepository.saveAndFlush(movie).getMovieId();

        CinemaRoom room = new CinemaRoom();
        room.setCinemaRoomName("Concurrency Room");
        room.setTotalSeatCapacity(100);
        room.setNumberOfRows(10);
        room.setSeatsPerRow(10);
        room.setStatus(CinemaRoomStatus.ACTIVE);
        roomId = cinemaRoomRepository.saveAndFlush(room).getCinemaRoomId();
    }

    @Test
    void concurrentBulkRequestsCreateOnlyOneShowtimeForSameSlot() throws Exception {
        BulkShowTimeRequest request = request();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<BulkShowTimeCreateResponse> first = executor.submit(() -> execute(request, ready, start));
            Future<BulkShowTimeCreateResponse> second = executor.submit(() -> execute(request, ready, start));

            ready.await();
            start.countDown();

            int totalCreated = first.get().getCreatedCount() + second.get().getCreatedCount();
            assertEquals(1, totalCreated);
            assertEquals(1, showTimeRepository.count());
        }
    }

    private BulkShowTimeCreateResponse execute(
            BulkShowTimeRequest request, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        return showTimeService.bulkCreate(request);
    }

    private BulkShowTimeRequest request() {
        BulkShowTimeRequest request = new BulkShowTimeRequest();
        request.setMovieId(movieId);
        request.setCinemaRoomIds(List.of(roomId));
        request.setFromDate(LocalDate.now().plusDays(3));
        request.setToDate(LocalDate.now().plusDays(3));
        request.setStartTimes(List.of(LocalTime.of(10, 0)));
        request.setBasePrice(new BigDecimal("100000.00"));
        request.setLanguageCode("vi");
        return request;
    }
}
