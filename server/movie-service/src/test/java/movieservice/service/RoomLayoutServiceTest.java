package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.LayoutPositionRequest;
import movieservice.dto.request.RoomLayoutSaveRequest;
import movieservice.dto.response.RoomLayoutResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.RoomLayout;
import movieservice.entity.RoomLayoutPosition;
import movieservice.enums.LayoutPositionType;
import movieservice.enums.LayoutStatus;
import movieservice.enums.SeatType;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.RoomLayoutAuditLogRepository;
import movieservice.repository.RoomLayoutPositionRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.repository.SeatRepository;
import movieservice.repository.ShowTimeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomLayoutServiceTest {

    @Mock RoomLayoutRepository roomLayoutRepository;
    @Mock RoomLayoutPositionRepository positionRepository;
    @Mock RoomLayoutAuditLogRepository auditLogRepository;
    @Mock CinemaRoomRepository cinemaRoomRepository;
    @Mock SeatRepository seatRepository;
    @Mock ShowTimeRepository showTimeRepository;

    RoomLayoutService roomLayoutService;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-07-16T00:00:00Z"), ZoneOffset.UTC);
        roomLayoutService = new RoomLayoutService(roomLayoutRepository, positionRepository, auditLogRepository,
                cinemaRoomRepository, seatRepository, showTimeRepository, clock);

        lenient().when(roomLayoutRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(positionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(cinemaRoomRepository.findByIdForUpdate(anyLong()))
                .thenAnswer(inv -> Optional.of(room(inv.getArgument(0))));
    }

    private CinemaRoom room(long roomId) {
        return CinemaRoom.builder().cinemaRoomId(roomId).build();
    }

    private RoomLayout draftLayout(long roomId, long layoutId, int version) {
        return RoomLayout.builder()
                .roomLayoutId(layoutId)
                .cinemaRoom(room(roomId))
                .version(version)
                .status(LayoutStatus.DRAFT)
                .build();
    }

    private LayoutPositionRequest seat(int row, int col, String rowLabel, int seatNumber, String seatCode,
            SeatType type, String groupId) {
        return LayoutPositionRequest.builder()
                .rowIndex(row).columnIndex(col).rowLabel(rowLabel)
                .positionType(LayoutPositionType.SEAT)
                .seatNumber(seatNumber).seatCode(seatCode).seatType(type).seatGroupId(groupId)
                .build();
    }

    private LayoutPositionRequest aisle(int row, int col, String rowLabel) {
        return LayoutPositionRequest.builder()
                .rowIndex(row).columnIndex(col).rowLabel(rowLabel)
                .positionType(LayoutPositionType.AISLE)
                .build();
    }

    // ── saveLayout / capacity calc ──────────────────────────────────────────

    @Test
    void saveLayout_computesCapacity_withStandardVipAndCoupleGroup() {
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(draftLayout(1L, 1L, 1)));

        RoomLayoutSaveRequest request = RoomLayoutSaveRequest.builder()
                .positions(List.of(
                        seat(0, 0, "A", 1, "A1", SeatType.STANDARD, null),
                        seat(0, 1, "A", 2, "A2", SeatType.VIP, null),
                        aisle(0, 2, "A"),
                        seat(0, 3, "A", 3, "A3", SeatType.COUPLE, "g1"),
                        seat(0, 4, "A", 4, "A4", SeatType.COUPLE, "g1")))
                .build();

        RoomLayoutResponse response = roomLayoutService.saveLayout(1L, 1L, request, "tester");

        assertEquals(4, response.getPersonCapacity()); // standard(1) + vip(1) + couple group(2)
        assertEquals(3, response.getSellableUnitCount()); // standard(1) + vip(1) + couple group(1)
    }

    @Test
    void saveLayout_rejectsDuplicateCoordinate() {
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(draftLayout(1L, 1L, 1)));

        RoomLayoutSaveRequest request = RoomLayoutSaveRequest.builder()
                .positions(List.of(
                        seat(0, 0, "A", 1, "A1", SeatType.STANDARD, null),
                        seat(0, 0, "A", 2, "A2", SeatType.STANDARD, null)))
                .build();

        AppException ex = assertThrows(AppException.class,
                () -> roomLayoutService.saveLayout(1L, 1L, request, "tester"));
        assertEquals(MovieErrorCode.ROOM_LAYOUT_POSITION_DUPLICATE_COORDINATE, ex.getErrorCode());
    }

    @Test
    void saveLayout_rejectsCoupleSinglePosition() {
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(draftLayout(1L, 1L, 1)));

        RoomLayoutSaveRequest request = RoomLayoutSaveRequest.builder()
                .positions(List.of(seat(0, 0, "A", 1, "A1", SeatType.COUPLE, "g1")))
                .build();

        AppException ex = assertThrows(AppException.class,
                () -> roomLayoutService.saveLayout(1L, 1L, request, "tester"));
        assertEquals(MovieErrorCode.ROOM_LAYOUT_COUPLE_GROUP_INVALID, ex.getErrorCode());
    }

    @Test
    void saveLayout_rejectsCoupleNotAdjacent() {
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(draftLayout(1L, 1L, 1)));

        RoomLayoutSaveRequest request = RoomLayoutSaveRequest.builder()
                .positions(List.of(
                        seat(0, 0, "A", 1, "A1", SeatType.COUPLE, "g1"),
                        seat(0, 2, "A", 2, "A2", SeatType.COUPLE, "g1")))
                .build();

        AppException ex = assertThrows(AppException.class,
                () -> roomLayoutService.saveLayout(1L, 1L, request, "tester"));
        assertEquals(MovieErrorCode.ROOM_LAYOUT_COUPLE_GROUP_INVALID, ex.getErrorCode());
    }

    @Test
    void saveLayout_rejectsCoupleDifferentRow() {
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(draftLayout(1L, 1L, 1)));

        RoomLayoutSaveRequest request = RoomLayoutSaveRequest.builder()
                .positions(List.of(
                        seat(0, 0, "A", 1, "A1", SeatType.COUPLE, "g1"),
                        seat(1, 0, "B", 1, "B1", SeatType.COUPLE, "g1")))
                .build();

        AppException ex = assertThrows(AppException.class,
                () -> roomLayoutService.saveLayout(1L, 1L, request, "tester"));
        assertEquals(MovieErrorCode.ROOM_LAYOUT_COUPLE_GROUP_INVALID, ex.getErrorCode());
    }

    @Test
    void saveLayout_rejectsWhenLayoutNotDraft() {
        RoomLayout approved = draftLayout(1L, 1L, 1);
        approved.setStatus(LayoutStatus.APPROVED);
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(approved));

        RoomLayoutSaveRequest request = RoomLayoutSaveRequest.builder().positions(List.of()).build();

        AppException ex = assertThrows(AppException.class,
                () -> roomLayoutService.saveLayout(1L, 1L, request, "tester"));
        assertEquals(MovieErrorCode.ROOM_LAYOUT_NOT_EDITABLE, ex.getErrorCode());
    }

    @Test
    void saveLayout_rejectsWrongRoomId() {
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(draftLayout(99L, 1L, 1)));

        RoomLayoutSaveRequest request = RoomLayoutSaveRequest.builder().positions(List.of()).build();

        AppException ex = assertThrows(AppException.class,
                () -> roomLayoutService.saveLayout(1L, 1L, request, "tester"));
        assertEquals(MovieErrorCode.ROOM_LAYOUT_NOT_FOUND, ex.getErrorCode());
    }

    // ── submit ───────────────────────────────────────────────────────────────

    @Test
    void submit_rejectsEmptyLayout() {
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(draftLayout(1L, 1L, 1)));
        when(positionRepository.findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(1L))
                .thenReturn(List.of());

        AppException ex = assertThrows(AppException.class,
                () -> roomLayoutService.submit(1L, 1L, "tester"));
        assertEquals(MovieErrorCode.ROOM_LAYOUT_EMPTY, ex.getErrorCode());
    }

    @Test
    void submit_rejectsWhenNotDraft() {
        RoomLayout pending = draftLayout(1L, 1L, 1);
        pending.setStatus(LayoutStatus.PENDING_APPROVAL);
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(pending));

        AppException ex = assertThrows(AppException.class,
                () -> roomLayoutService.submit(1L, 1L, "tester"));
        assertEquals(MovieErrorCode.ROOM_LAYOUT_INVALID_TRANSITION, ex.getErrorCode());
    }

    @Test
    void submit_movesToPendingApproval() {
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(draftLayout(1L, 1L, 1)));
        RoomLayoutPosition p = RoomLayoutPosition.builder()
                .rowIndex(0).columnIndex(0).rowLabel("A")
                .positionType(LayoutPositionType.SEAT)
                .seatNumber(1).seatCode("A1").seatType(SeatType.STANDARD)
                .build();
        when(positionRepository.findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(1L))
                .thenReturn(List.of(p));
        when(cinemaRoomRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        RoomLayoutResponse response = roomLayoutService.submit(1L, 1L, "tester");
        assertEquals("PENDING_APPROVAL", response.getStatus());
    }

    @Test
    void submit_rejectsLayoutThatExceedsRoomCapacityEnvelope() {
        CinemaRoom tinyRoom = CinemaRoom.builder()
                .cinemaRoomId(1L)
                .lengthM(new BigDecimal("5"))
                .widthM(new BigDecimal("5"))
                .clearHeightM(new BigDecimal("3"))
                .screenWidthM(new BigDecimal("2"))
                .build();
        RoomLayout layout = RoomLayout.builder()
                .roomLayoutId(1L).cinemaRoom(tinyRoom).version(1).status(LayoutStatus.DRAFT)
                .build();
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(layout));
        when(cinemaRoomRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(tinyRoom));

        List<RoomLayoutPosition> positions = new ArrayList<>();
        for (int row = 0; row < 10; row++) {
            for (int column = 0; column < 10; column++) {
                positions.add(RoomLayoutPosition.builder()
                        .rowIndex(row).columnIndex(column).rowLabel(String.valueOf((char) ('A' + row)))
                        .positionType(LayoutPositionType.SEAT)
                        .seatNumber(column + 1).seatCode("" + (char) ('A' + row) + (column + 1))
                        .seatType(SeatType.STANDARD)
                        .build());
            }
        }
        when(positionRepository.findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(1L))
                .thenReturn(positions);

        AppException ex = assertThrows(AppException.class,
                () -> roomLayoutService.submit(1L, 1L, "tester"));
        assertEquals(MovieErrorCode.ROOM_LAYOUT_EXCEEDS_ROOM_ENVELOPE, ex.getErrorCode());
    }

    // ── approve / activate ──────────────────────────────────────────────────

    @Test
    void approve_rejectsWhenNotPendingApproval() {
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(draftLayout(1L, 1L, 1)));

        AppException ex = assertThrows(AppException.class,
                () -> roomLayoutService.approve(1L, 1L, "admin"));
        assertEquals(MovieErrorCode.ROOM_LAYOUT_INVALID_TRANSITION, ex.getErrorCode());
    }

    @Test
    void activate_rejectsWhenNotApproved() {
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(draftLayout(1L, 1L, 1)));

        AppException ex = assertThrows(AppException.class,
                () -> roomLayoutService.activate(1L, 1L, "admin"));
        assertEquals(MovieErrorCode.ROOM_LAYOUT_INVALID_TRANSITION, ex.getErrorCode());
    }

    // ── clone ────────────────────────────────────────────────────────────────

    @Test
    void clone_createsNextVersionAsDraft() {
        RoomLayout source = draftLayout(1L, 5L, 2);
        source.setStatus(LayoutStatus.ACTIVE);
        when(roomLayoutRepository.findById(5L)).thenReturn(Optional.of(source));
        when(positionRepository.findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(5L))
                .thenReturn(new ArrayList<>());

        RoomLayout otherVersion = draftLayout(1L, 4L, 2);
        when(roomLayoutRepository.findByCinemaRoomCinemaRoomIdOrderByVersionDesc(1L))
                .thenReturn(List.of(otherVersion));

        RoomLayoutResponse response = roomLayoutService.clone(1L, 5L, "tester");

        assertEquals(3, response.getVersion());
        assertEquals("DRAFT", response.getStatus());
    }

    @Test
    void clone_rejectsSourceStillDraft() {
        when(roomLayoutRepository.findById(1L)).thenReturn(Optional.of(draftLayout(1L, 1L, 1)));

        AppException ex = assertThrows(AppException.class,
                () -> roomLayoutService.clone(1L, 1L, "tester"));
        assertEquals(MovieErrorCode.ROOM_LAYOUT_INVALID_TRANSITION, ex.getErrorCode());
    }
}
