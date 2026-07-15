package movieservice.service;

import movieservice.entity.CinemaRoom;
import movieservice.entity.Seat;
import movieservice.enums.RoomType;
import movieservice.enums.SeatType;
import movieservice.mapper.MovieMapper;
import movieservice.repository.SeatRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SeatServiceTest {

    @Mock
    SeatRepository seatRepository;

    @Mock
    MovieMapper movieMapper;

    @InjectMocks
    SeatService seatService;

    @Test
    void generateSeatsUsesPerRoomAllocationInsteadOfRoomTypeDefaults() {
        CinemaRoom room = CinemaRoom.builder()
                .cinemaRoomName("Configurable IMAX")
                .roomType(RoomType.IMAX)
                .numberOfRows(10)
                .seatsPerRow(10)
                .totalSeatCapacity(100)
                .standardRowCount(5)
                .vipRowCount(3)
                .coupleRowCount(2)
                .build();

        seatService.generateSeatsForRoom(room, new BigDecimal("100000"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<Seat>> captor = ArgumentCaptor.forClass(Iterable.class);
        verify(seatRepository).saveAll(captor.capture());

        List<Seat> generated = new ArrayList<>();
        captor.getValue().forEach(generated::add);

        assertEquals(50, countByType(generated, SeatType.STANDARD));
        assertEquals(28, countByType(generated, SeatType.VIP));
        assertEquals(2, countByType(generated, SeatType.ACCESSIBLE));
        assertEquals(10, countByType(generated, SeatType.COUPLE));
        assertEquals(90, generated.size(), "Couple records each represent two physical positions");

        assertTrue(generated.stream()
                .filter(seat -> seat.getSeatType() == SeatType.COUPLE)
                .allMatch(seat -> seat.getRowLabel().equals("I") || seat.getRowLabel().equals("J")));
        assertTrue(generated.stream()
                .filter(seat -> seat.getSeatType() == SeatType.COUPLE)
                .allMatch(seat -> seat.getPrice().compareTo(new BigDecimal("180000.0")) == 0));
    }

    private long countByType(List<Seat> seats, SeatType type) {
        return seats.stream().filter(seat -> seat.getSeatType() == type).count();
    }
}
