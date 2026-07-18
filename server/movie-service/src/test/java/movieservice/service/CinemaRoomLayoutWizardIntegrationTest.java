package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.request.LayoutPositionRequest;
import movieservice.dto.request.RoomLayoutSaveRequest;
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.dto.response.RoomLayoutResponse;
import movieservice.entity.AuditoriumClass;
import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.RoomLayout;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.ClusterStatus;
import movieservice.enums.LayoutPositionType;
import movieservice.enums.LayoutStatus;
import movieservice.enums.MovieStatus;
import movieservice.enums.NumberingDirection;
import movieservice.enums.SeatStatus;
import movieservice.enums.SeatType;
import movieservice.enums.ShowTimeStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.AuditoriumClassRepository;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.RoomLayoutPositionRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.repository.SeatRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeSeatRepository;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * End-to-end coverage of the wizard's core promise: draft room -> layout authoring
 * -> submit/approve/activate -> Seat table sync, without disturbing any Seat/ShowtimeSeat
 * a real booking already depends on (SEAT-P0-001 snapshot immutability).
 */
@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false"
})
@Testcontainers(disabledWithoutDocker = true)
class CinemaRoomLayoutWizardIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("movie_service_room_layout_test")
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
    @Autowired CinemaClusterRepository cinemaClusterRepository;
    @Autowired CinemaRoomRepository cinemaRoomRepository;
    @Autowired RoomLayoutRepository roomLayoutRepository;
    @Autowired RoomLayoutPositionRepository roomLayoutPositionRepository;
    @Autowired AuditoriumClassRepository auditoriumClassRepository;
    @Autowired SeatRepository seatRepository;
    @Autowired ShowTimeRepository showTimeRepository;
    @Autowired ShowtimeSeatRepository showtimeSeatRepository;
    @Autowired MovieRepository movieRepository;

    Long clusterId;
    Integer auditoriumClassId;

    @BeforeEach
    void setUp() {
        showtimeSeatRepository.deleteAll();
        showTimeRepository.deleteAll();
        roomLayoutPositionRepository.deleteAll();
        roomLayoutRepository.deleteAll();
        seatRepository.deleteAll();
        cinemaRoomRepository.deleteAll();
        cinemaClusterRepository.deleteAll();
        auditoriumClassRepository.deleteAll();
        movieRepository.deleteAll();

        CinemaCluster cluster = CinemaCluster.builder()
                .clusterCode("IT-CLUSTER-1")
                .clusterName("Integration Test Cluster")
                .province("HCM")
                .address("123 Test St")
                .status(ClusterStatus.ACTIVE)
                .build();
        clusterId = cinemaClusterRepository.saveAndFlush(cluster).getClusterId();

        AuditoriumClass auditoriumClass = AuditoriumClass.builder()
                .classCode("STANDARD").className("Standard").active(true).build();
        auditoriumClassId = auditoriumClassRepository.saveAndFlush(auditoriumClass).getClassId();
    }

    private LayoutPositionRequest seat(int row, int col, String rowLabel, int seatNumber, String seatCode,
            SeatType type, String groupId) {
        return LayoutPositionRequest.builder()
                .rowIndex(row).columnIndex(col).rowLabel(rowLabel)
                .positionType(LayoutPositionType.SEAT)
                .seatNumber(seatNumber).seatCode(seatCode).seatType(type).seatGroupId(groupId)
                .build();
    }

    private LayoutPositionRequest emptySpace(int row, int col, String rowLabel) {
        return LayoutPositionRequest.builder()
                .rowIndex(row).columnIndex(col).rowLabel(rowLabel)
                .positionType(LayoutPositionType.EMPTY_SPACE)
                .build();
    }

    @Test
    void wizardFlow_draftToActive_syncsSeatsAndPreservesReferencedShowtimeSeat() {
        // 1. Create DRAFT room via the wizard — no flat Seat generation yet.
        CinemaRoomRequest createRequest = CinemaRoomRequest.builder()
                .cinemaRoomName("Wizard Room 1")
                .roomCode("W1")
                .auditoriumClassId(auditoriumClassId)
                .lengthM(new BigDecimal("20"))
                .widthM(new BigDecimal("15"))
                .clearHeightM(new BigDecimal("6"))
                .clusterId(clusterId)
                .build();
        CinemaRoomResponse roomResponse = cinemaRoomService.createCinemaRoom(createRequest, "employee1");
        assertEquals(CinemaRoomStatus.DRAFT, roomResponse.getStatus());
        Long roomId = roomResponse.getCinemaRoomId();
        assertTrue(seatRepository.findByCinemaRoomCinemaRoomId(roomId).isEmpty());

        RoomLayout layoutV1 = roomLayoutRepository
                .findByCinemaRoomCinemaRoomIdOrderByVersionDesc(roomId).get(0);
        Long layoutId = layoutV1.getRoomLayoutId();
        assertEquals(1, layoutV1.getVersion());
        assertEquals(LayoutStatus.DRAFT, layoutV1.getStatus());

        // 2. Author the layout: 2 Standard seats + 1 Couple pair (atomic group).
        RoomLayoutSaveRequest saveRequest = RoomLayoutSaveRequest.builder()
                .numberOfRows(1).maxPositionsPerRow(4).firstRowLabel("A")
                .numberingDirection(NumberingDirection.LEFT_TO_RIGHT)
                .positions(List.of(
                        seat(0, 0, "A", 1, "A1", SeatType.STANDARD, null),
                        seat(0, 1, "A", 2, "A2", SeatType.STANDARD, null),
                        seat(0, 2, "A", 3, "A3", SeatType.COUPLE, "g1"),
                        seat(0, 3, "A", 4, "A4", SeatType.COUPLE, "g1")))
                .build();
        RoomLayoutResponse saved = roomLayoutService.saveLayout(roomId, layoutId, saveRequest, "employee1");
        assertEquals(4, saved.getPersonCapacity());
        assertEquals(3, saved.getSellableUnitCount());

        // 3. Submit -> both layout and room move to PENDING_APPROVAL.
        roomLayoutService.submit(roomId, layoutId, "employee1");
        assertEquals(CinemaRoomStatus.PENDING_APPROVAL, cinemaRoomRepository.findById(roomId).get().getStatus());

        // 4. Approve (ADMIN) -> APPROVED.
        roomLayoutService.approve(roomId, layoutId, "admin1");
        assertEquals(CinemaRoomStatus.APPROVED, cinemaRoomRepository.findById(roomId).get().getStatus());

        // 5. Activate -> Seat rows are synced; room becomes ACTIVE.
        roomLayoutService.activate(roomId, layoutId, "admin1");
        CinemaRoom activatedRoom = cinemaRoomRepository.findById(roomId).get();
        assertEquals(CinemaRoomStatus.ACTIVE, activatedRoom.getStatus());
        assertEquals(LayoutStatus.ACTIVE, roomLayoutRepository.findById(layoutId).get().getStatus());

        List<Seat> seats = seatRepository.findByCinemaRoomCinemaRoomId(roomId);
        assertEquals(3, seats.size(), "2 standard units + 1 couple unit = 3 sellable Seat rows");
        Seat coupleSeat = seats.stream().filter(s -> s.getSeatType() == SeatType.COUPLE).findFirst().orElseThrow();
        assertEquals("g1", coupleSeat.getSeatGroupId());
        Seat standardSeatA1 = seats.stream()
                .filter(s -> s.getRowLabel().equals("A") && s.getColNumber() == 1).findFirst().orElseThrow();

        // 6. Simulate a real booking: a past/completed showtime references standardSeatA1.
        Movie movie = Movie.builder()
                .originalTitle("Integration Test Movie")
                .originalLanguage("en")
                .durationMinutes(100)
                .status(MovieStatus.APPROVED)
                .build();
        movie = movieRepository.saveAndFlush(movie);

        ShowTime pastShowTime = ShowTime.builder()
                .movie(movie).cinemaRoom(activatedRoom)
                .showDate(LocalDate.now().minusDays(1))
                .startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(12, 0))
                .status(ShowTimeStatus.COMPLETED)
                .build();
        pastShowTime = showTimeRepository.saveAndFlush(pastShowTime);

        ShowtimeSeat showtimeSeat = ShowtimeSeat.builder()
                .showTime(pastShowTime).seat(standardSeatA1)
                .seatCode(standardSeatA1.getSeatCode()).seatType(SeatType.STANDARD)
                .price(BigDecimal.valueOf(90000))
                .build();
        showtimeSeat = showtimeSeatRepository.saveAndFlush(showtimeSeat);
        Long standardSeatId = standardSeatA1.getSeatId();

        // 7. Clone -> new DRAFT version that DROPS seat A1 (replaced by EMPTY_SPACE), then
        //    submit/approve/activate it. Because the only prior showtime is COMPLETED (not
        //    SCHEDULED/ON_SALE), activation must be allowed to proceed.
        RoomLayoutResponse clone = roomLayoutService.clone(roomId, layoutId, "employee1");
        Long v2LayoutId = clone.getRoomLayoutId();
        assertEquals(2, clone.getVersion());

        RoomLayoutSaveRequest v2Request = RoomLayoutSaveRequest.builder()
                .numberOfRows(1).maxPositionsPerRow(4).firstRowLabel("A")
                .numberingDirection(NumberingDirection.LEFT_TO_RIGHT)
                .positions(List.of(
                        emptySpace(0, 0, "A"),
                        seat(0, 1, "A", 2, "A2", SeatType.STANDARD, null),
                        seat(0, 2, "A", 3, "A3", SeatType.COUPLE, "g2"),
                        seat(0, 3, "A", 4, "A4", SeatType.COUPLE, "g2")))
                .build();
        roomLayoutService.saveLayout(roomId, v2LayoutId, v2Request, "employee1");
        roomLayoutService.submit(roomId, v2LayoutId, "employee1");
        roomLayoutService.approve(roomId, v2LayoutId, "admin1");
        roomLayoutService.activate(roomId, v2LayoutId, "admin1");

        // 8. v1 is SUPERSEDED, v2 is ACTIVE.
        assertEquals(LayoutStatus.SUPERSEDED, roomLayoutRepository.findById(layoutId).get().getStatus());
        assertEquals(LayoutStatus.ACTIVE, roomLayoutRepository.findById(v2LayoutId).get().getStatus());

        // 9. standardSeatA1 is soft-retired (INACTIVE), never deleted, and the pre-existing
        //    ShowtimeSeat row still resolves to the exact same Seat identity.
        Seat retiredSeat = seatRepository.findById(standardSeatId).orElseThrow();
        assertEquals(SeatStatus.INACTIVE, retiredSeat.getStatus());

        ShowtimeSeat reloadedShowtimeSeat = showtimeSeatRepository.findById(showtimeSeat.getShowtimeSeatId())
                .orElseThrow();
        assertEquals(standardSeatId, reloadedShowtimeSeat.getSeat().getSeatId());
    }

    @Test
    void activate_blockedByFutureShowtimesOnCurrentActiveLayout() {
        CinemaRoomRequest createRequest = CinemaRoomRequest.builder()
                .cinemaRoomName("Wizard Room 2")
                .roomCode("W2")
                .auditoriumClassId(auditoriumClassId)
                .lengthM(new BigDecimal("20"))
                .widthM(new BigDecimal("15"))
                .clearHeightM(new BigDecimal("6"))
                .clusterId(clusterId)
                .build();
        CinemaRoomResponse roomResponse = cinemaRoomService.createCinemaRoom(createRequest, "employee1");
        Long roomId = roomResponse.getCinemaRoomId();
        RoomLayout layoutV1 = roomLayoutRepository
                .findByCinemaRoomCinemaRoomIdOrderByVersionDesc(roomId).get(0);
        Long layoutId = layoutV1.getRoomLayoutId();

        roomLayoutService.saveLayout(roomId, layoutId, RoomLayoutSaveRequest.builder()
                .positions(List.of(seat(0, 0, "A", 1, "A1", SeatType.STANDARD, null)))
                .build(), "employee1");
        roomLayoutService.submit(roomId, layoutId, "employee1");
        roomLayoutService.approve(roomId, layoutId, "admin1");
        roomLayoutService.activate(roomId, layoutId, "admin1");

        CinemaRoom activatedRoom = cinemaRoomRepository.findById(roomId).get();
        Movie movie = movieRepository.saveAndFlush(Movie.builder()
                .originalTitle("Future Showtime Movie").originalLanguage("en")
                .durationMinutes(100).status(MovieStatus.APPROVED).build());
        showTimeRepository.saveAndFlush(ShowTime.builder()
                .movie(movie).cinemaRoom(activatedRoom)
                .showDate(LocalDate.now().plusDays(3))
                .startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(12, 0))
                .status(ShowTimeStatus.ON_SALE)
                .build());

        RoomLayoutResponse clone = roomLayoutService.clone(roomId, layoutId, "employee1");
        Long v2LayoutId = clone.getRoomLayoutId();
        roomLayoutService.saveLayout(roomId, v2LayoutId, RoomLayoutSaveRequest.builder()
                .positions(List.of(seat(0, 0, "A", 1, "A1", SeatType.VIP, null)))
                .build(), "employee1");
        roomLayoutService.submit(roomId, v2LayoutId, "employee1");
        roomLayoutService.approve(roomId, v2LayoutId, "admin1");

        AppException ex = assertThrows(AppException.class,
                () -> roomLayoutService.activate(roomId, v2LayoutId, "admin1"));
        assertEquals(MovieErrorCode.ROOM_LAYOUT_HAS_FUTURE_SHOWTIMES, ex.getErrorCode());
    }
}
