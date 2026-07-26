package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.entity.CinemaRoom;
import movieservice.entity.RoomLayout;
import movieservice.entity.RoomLayoutPosition;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.LayoutPositionType;
import movieservice.enums.LayoutStatus;
import movieservice.enums.SeatStatus;
import movieservice.enums.SeatType;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.RoomLayoutPositionRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.repository.SeatRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeSeatRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShowtimeInventoryServiceTest {

    @Mock ShowTimeRepository showTimeRepository;
    @Mock ShowtimeSeatRepository showtimeSeatRepository;
    @Mock RoomLayoutRepository roomLayoutRepository;
    @Mock RoomLayoutPositionRepository roomLayoutPositionRepository;
    @Mock SeatRepository seatRepository;

    @InjectMocks
    ShowtimeInventoryService service;

    @Test
    void materializesSellableUnitsFromActiveLayoutAndCollapsesCouplePair() {
        CinemaRoom room = CinemaRoom.builder().cinemaRoomId(3L).build();
        ShowTime showtime = ShowTime.builder()
                .showTimeId(9L)
                .cinemaRoom(room)
                .basePrice(new BigDecimal("120000.00"))
                .build();
        RoomLayout layout = RoomLayout.builder()
                .roomLayoutId(30L)
                .cinemaRoom(room)
                .version(4)
                .status(LayoutStatus.ACTIVE)
                .personCapacity(3)
                .sellableUnitCount(2)
                .build();

        List<RoomLayoutPosition> positions = List.of(
                position(layout, 0, "A1", SeatType.STANDARD, null),
                position(layout, 1, "A2", SeatType.COUPLE, "couple-a"),
                position(layout, 2, "A3", SeatType.COUPLE, "couple-a"));
        List<Seat> seats = List.of(
                seat(room, 10L, 1, SeatType.STANDARD, null),
                seat(room, 11L, 2, SeatType.COUPLE, "couple-a"));

        when(showTimeRepository.findByIdForUpdate(9L)).thenReturn(Optional.of(showtime));
        when(showtimeSeatRepository.findByShowTime_ShowTimeId(9L)).thenReturn(List.of());
        when(roomLayoutRepository.findByCinemaRoomCinemaRoomIdAndStatus(3L, LayoutStatus.ACTIVE))
                .thenReturn(Optional.of(layout));
        when(roomLayoutPositionRepository
                .findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(30L))
                .thenReturn(positions);
        when(seatRepository.findByCinemaRoomCinemaRoomId(3L)).thenReturn(seats);
        when(showtimeSeatRepository.saveAll(anyList()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        List<ShowtimeSeat> inventory = service.materialize(9L);

        assertEquals(2, inventory.size());
        assertEquals(3, showtime.getTotalSeats());
        assertEquals("A1", inventory.get(0).getSeatCode());
        assertEquals("A2", inventory.get(1).getSeatCode());
        assertEquals("couple-a", inventory.get(1).getSeatGroupId());
        assertEquals(30L, inventory.get(1).getRoomLayout().getRoomLayoutId());
        assertEquals(4, inventory.get(1).getLayoutVersion());
        assertEquals(new BigDecimal("216000.00"), inventory.get(1).getPrice());
    }

    @Test
    void repeatedMaterializationReturnsExistingInventoryWithoutDuplicatingRows() {
        ShowTime showtime = ShowTime.builder().showTimeId(9L).build();
        ShowtimeSeat existing = ShowtimeSeat.builder().showtimeSeatId(50L).build();
        when(showTimeRepository.findByIdForUpdate(9L)).thenReturn(Optional.of(showtime));
        when(showtimeSeatRepository.findByShowTime_ShowTimeId(9L))
                .thenReturn(List.of(existing));

        List<ShowtimeSeat> result = service.materialize(9L);

        assertEquals(List.of(existing), result);
        verify(roomLayoutRepository, never())
                .findByCinemaRoomCinemaRoomIdAndStatus(
                        org.mockito.ArgumentMatchers.anyLong(),
                        org.mockito.ArgumentMatchers.any());
        verify(showtimeSeatRepository, never()).saveAll(anyList());
    }

    @Test
    void rejectsActiveLayoutAndMasterSeatMismatch() {
        CinemaRoom room = CinemaRoom.builder().cinemaRoomId(3L).build();
        ShowTime showtime = ShowTime.builder().showTimeId(9L).cinemaRoom(room).build();
        RoomLayout layout = RoomLayout.builder()
                .roomLayoutId(30L)
                .version(1)
                .status(LayoutStatus.ACTIVE)
                .personCapacity(1)
                .sellableUnitCount(1)
                .build();

        when(showTimeRepository.findByIdForUpdate(9L)).thenReturn(Optional.of(showtime));
        when(showtimeSeatRepository.findByShowTime_ShowTimeId(9L)).thenReturn(List.of());
        when(roomLayoutRepository.findByCinemaRoomCinemaRoomIdAndStatus(3L, LayoutStatus.ACTIVE))
                .thenReturn(Optional.of(layout));
        when(roomLayoutPositionRepository
                .findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(30L))
                .thenReturn(List.of(position(layout, 0, "A1", SeatType.STANDARD, null)));
        when(seatRepository.findByCinemaRoomCinemaRoomId(3L)).thenReturn(List.of());

        AppException exception = assertThrows(
                AppException.class, () -> service.materialize(9L));

        assertEquals(MovieErrorCode.SHOWTIME_LAYOUT_SEAT_MISMATCH, exception.getErrorCode());
        verify(showtimeSeatRepository, never()).saveAll(anyList());
    }

    private RoomLayoutPosition position(
            RoomLayout layout,
            int columnIndex,
            String seatCode,
            SeatType seatType,
            String groupId) {
        return RoomLayoutPosition.builder()
                .roomLayout(layout)
                .rowIndex(0)
                .columnIndex(columnIndex)
                .rowLabel("A")
                .positionType(LayoutPositionType.SEAT)
                .seatCode(seatCode)
                .seatNumber(columnIndex + 1)
                .seatType(seatType)
                .seatGroupId(groupId)
                .seatStatus(SeatStatus.ACTIVE)
                .build();
    }

    private Seat seat(
            CinemaRoom room,
            Long id,
            int colNumber,
            SeatType seatType,
            String groupId) {
        return Seat.builder()
                .seatId(id)
                .cinemaRoom(room)
                .rowLabel("A")
                .colNumber(colNumber)
                .seatCode("A" + colNumber)
                .seatType(seatType)
                .seatGroupId(groupId)
                .status(SeatStatus.ACTIVE)
                .price(new BigDecimal("90000.00"))
                .build();
    }
}
