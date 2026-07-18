package movieservice.service;

import movieservice.entity.CinemaRoom;
import movieservice.entity.RoomLayout;
import movieservice.entity.RoomLayoutPosition;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.LayoutPositionType;
import movieservice.enums.LayoutStatus;
import movieservice.enums.RoomType;
import movieservice.enums.SeatStatus;
import movieservice.enums.SeatType;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.RoomLayoutPositionRepository;
import movieservice.repository.RoomLayoutRepository;
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
class CinemaRoomDeletionConcurrencyIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("movie_service_room_delete_test")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired CinemaRoomService cinemaRoomService;
    @Autowired RoomLayoutService roomLayoutService;
    @Autowired CinemaRoomRepository cinemaRoomRepository;
    @Autowired RoomLayoutRepository roomLayoutRepository;
    @Autowired RoomLayoutPositionRepository positionRepository;

    Long roomId;
    Long layoutId;

    @BeforeEach
    void setUp() {
        positionRepository.deleteAll();
        roomLayoutRepository.deleteAll();
        cinemaRoomRepository.deleteAll();

        CinemaRoom room = CinemaRoom.builder()
                .cinemaRoomName("Delete race room")
                .roomCode("R-DELETE-RACE")
                .roomType(RoomType.STANDARD)
                .totalSeatCapacity(0)
                .numberOfRows(1)
                .seatsPerRow(1)
                .standardRowCount(1)
                .vipRowCount(0)
                .coupleRowCount(0)
                .status(CinemaRoomStatus.DRAFT)
                .createdBy("employee.one")
                .updatedBy("employee.one")
                .build();
        room = cinemaRoomRepository.saveAndFlush(room);
        roomId = room.getCinemaRoomId();

        RoomLayout layout = RoomLayout.builder()
                .cinemaRoom(room)
                .version(1)
                .status(LayoutStatus.DRAFT)
                .numberOfRows(1)
                .maxPositionsPerRow(1)
                .personCapacity(1)
                .sellableUnitCount(1)
                .createdBy("employee.one")
                .updatedBy("employee.one")
                .build();
        layout = roomLayoutRepository.saveAndFlush(layout);
        layoutId = layout.getRoomLayoutId();

        positionRepository.saveAndFlush(RoomLayoutPosition.builder()
                .roomLayout(layout)
                .rowIndex(0)
                .columnIndex(0)
                .rowLabel("A")
                .positionType(LayoutPositionType.SEAT)
                .seatNumber(1)
                .seatCode("A1")
                .seatType(SeatType.STANDARD)
                .seatStatus(SeatStatus.ACTIVE)
                .build());
    }

    @Test
    void deleteRacingSubmit_allowsExactlyOneLifecycleCommandToWin() throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Boolean> delete = executor.submit(() -> runDelete(ready, start));
            Future<Boolean> submit = executor.submit(() -> runSubmit(ready, start));

            ready.await();
            start.countDown();

            int successes = (delete.get() ? 1 : 0) + (submit.get() ? 1 : 0);
            assertEquals(1, successes);
        }

        boolean roomExists = cinemaRoomRepository.existsById(roomId);
        boolean layoutExists = roomLayoutRepository.existsById(layoutId);
        assertTrue((!roomExists && !layoutExists) || (roomExists && layoutExists));
    }

    private boolean runDelete(CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        try {
            cinemaRoomService.deleteCinemaRoom(roomId,
                    new UsernamePasswordAuthenticationToken(
                            "admin.one", "n/a",
                            List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
            return true;
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private boolean runSubmit(CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        try {
            roomLayoutService.submit(roomId, layoutId, "employee.one");
            return true;
        } catch (RuntimeException exception) {
            return false;
        }
    }
}
