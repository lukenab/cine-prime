package movieservice.service;

import movieservice.dto.request.CreateShowTimeRequest;
import movieservice.dto.request.UpdateShowTimeRequest;
import movieservice.dto.response.ShowTimePricingResponse;
import movieservice.dto.response.ShowtimeSeatDto;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.SeatType;
import movieservice.enums.ShowTimeStatus;
import movieservice.enums.ShowtimeSeatStatus;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.SeatRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeSeatRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShowTimeServicePricingTest {

    @Mock ShowTimeRepository showTimeRepository;
    @Mock ShowtimeSeatRepository showtimeSeatRepository;
    @Mock SeatRepository seatRepository;
    @Mock MovieRepository movieRepository;
    @Mock CinemaRoomRepository cinemaRoomRepository;
    @Mock MovieMapper movieMapper;

    @InjectMocks
    ShowTimeService showTimeService;

    @Test
    void lazyInitPrefersShowtimeBasePrice() {
        assertEquals(new BigDecimal("120000.00"),
                initializeSeatPrice(new BigDecimal("120000.00"), new BigDecimal("90000.00")));
    }

    @Test
    void lazyInitFallsBackToSeatPrice() {
        assertEquals(new BigDecimal("90000.00"),
                initializeSeatPrice(null, new BigDecimal("90000.00")));
    }

    @Test
    void lazyInitFallsBackToSystemDefault() {
        assertEquals(new BigDecimal("85000.00"), initializeSeatPrice(null, null));
    }

    @Test
    void createPersistsAndReturnsBasePrice() {
        Movie movie = Movie.builder().movieId(1L).originalTitle("Movie").durationMinutes(90).build();
        CinemaRoom room = CinemaRoom.builder()
                .cinemaRoomId(3L)
                .cinemaRoomName("Room 3")
                .totalSeatCapacity(20)
                .build();
        CreateShowTimeRequest request = new CreateShowTimeRequest();
        request.setMovieId(1L);
        request.setCinemaRoomId(3L);
        request.setShowDate(LocalDate.now().plusDays(3));
        request.setStartTime(LocalTime.of(14, 30));
        request.setBasePrice(new BigDecimal("120000.00"));

        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(cinemaRoomRepository.findByCinemaRoomId(3L)).thenReturn(room);
        when(showTimeRepository.existsByCinemaRoomAndOverlappingTime(
                any(), any(), any(), any())).thenReturn(false);
        when(showTimeRepository.save(any(ShowTime.class))).thenAnswer(invocation -> {
            ShowTime value = invocation.getArgument(0);
            value.setShowTimeId(55L);
            return value;
        });

        ShowTimePricingResponse response = showTimeService.createStandalone(request);

        assertEquals(new BigDecimal("120000.00"), response.getBasePrice());
        assertEquals(55L, response.getShowTimeId());
    }

    @Test
    void createWithoutBasePricePersistsNullForSeatPriceFallback() {
        Movie movie = Movie.builder().movieId(1L).durationMinutes(90).build();
        CinemaRoom room = CinemaRoom.builder()
                .cinemaRoomId(3L)
                .totalSeatCapacity(20)
                .build();
        CreateShowTimeRequest request = new CreateShowTimeRequest();
        request.setMovieId(1L);
        request.setCinemaRoomId(3L);
        request.setShowDate(LocalDate.now().plusDays(3));
        request.setStartTime(LocalTime.of(14, 30));

        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(cinemaRoomRepository.findByCinemaRoomId(3L)).thenReturn(room);
        when(showTimeRepository.existsByCinemaRoomAndOverlappingTime(
                any(), any(), any(), any())).thenReturn(false);
        when(showTimeRepository.save(any(ShowTime.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ShowTimePricingResponse response = showTimeService.createStandalone(request);

        assertNull(response.getBasePrice());
    }

    @Test
    void updateOverrideRepricesAvailableSeatButPreservesReservedSeatSnapshot() {
        Seat masterSeat = Seat.builder().price(new BigDecimal("90000.00")).build();
        ShowtimeSeat available = showtimeSeat(
                ShowtimeSeatStatus.AVAILABLE, new BigDecimal("90000.00"), masterSeat);
        ShowtimeSeat reserved = showtimeSeat(
                ShowtimeSeatStatus.RESERVED, new BigDecimal("90000.00"), masterSeat);
        ShowTime showTime = ShowTime.builder().showTimeId(7L).build();
        UpdateShowTimeRequest request = new UpdateShowTimeRequest();
        request.setBasePrice(new BigDecimal("130000.00"));

        when(showTimeRepository.findById(7L)).thenReturn(Optional.of(showTime));
        when(showTimeRepository.save(showTime)).thenReturn(showTime);
        when(showtimeSeatRepository.findByShowTime_ShowTimeId(7L))
                .thenReturn(List.of(available, reserved));

        ShowTimePricingResponse response = showTimeService.update(7L, request);

        assertEquals(new BigDecimal("130000.00"), response.getBasePrice());
        assertEquals(new BigDecimal("130000.00"), available.getPrice());
        assertEquals(new BigDecimal("90000.00"), reserved.getPrice());
        verify(showtimeSeatRepository).saveAll(List.of(available));
    }

    @Test
    void updateCanClearOverrideAndOnlyRepriceUnbookedSeats() {
        Seat masterSeat = Seat.builder().price(new BigDecimal("90000.00")).build();
        ShowtimeSeat available = showtimeSeat(
                ShowtimeSeatStatus.AVAILABLE, new BigDecimal("120000.00"), masterSeat);
        ShowtimeSeat reserved = showtimeSeat(
                ShowtimeSeatStatus.RESERVED, new BigDecimal("120000.00"), masterSeat);
        ShowtimeSeat sold = showtimeSeat(
                ShowtimeSeatStatus.SOLD, new BigDecimal("120000.00"), masterSeat);
        ShowTime showTime = ShowTime.builder()
                .showTimeId(7L)
                .basePrice(new BigDecimal("120000.00"))
                .build();
        UpdateShowTimeRequest request = new UpdateShowTimeRequest();
        request.setBasePrice(null);

        when(showTimeRepository.findById(7L)).thenReturn(Optional.of(showTime));
        when(showTimeRepository.save(showTime)).thenReturn(showTime);
        when(showtimeSeatRepository.findByShowTime_ShowTimeId(7L))
                .thenReturn(List.of(available, reserved, sold));

        ShowTimePricingResponse response = showTimeService.update(7L, request);

        assertNull(response.getBasePrice());
        assertEquals(new BigDecimal("90000.00"), available.getPrice());
        assertEquals(new BigDecimal("120000.00"), reserved.getPrice());
        assertEquals(new BigDecimal("120000.00"), sold.getPrice());
        verify(showtimeSeatRepository).saveAll(List.of(available));
    }

    @Test
    void updateWithoutBasePriceKeepsOverrideAndDoesNotRepriceSeats() {
        ShowTime showTime = ShowTime.builder()
                .showTimeId(7L)
                .basePrice(new BigDecimal("120000.00"))
                .build();
        UpdateShowTimeRequest request = new UpdateShowTimeRequest();

        when(showTimeRepository.findById(7L)).thenReturn(Optional.of(showTime));
        when(showTimeRepository.save(showTime)).thenReturn(showTime);

        ShowTimePricingResponse response = showTimeService.update(7L, request);

        assertEquals(new BigDecimal("120000.00"), response.getBasePrice());
        verify(showtimeSeatRepository, never()).findByShowTime_ShowTimeId(any());
        verify(showtimeSeatRepository, never()).saveAll(anyList());
    }

    private BigDecimal initializeSeatPrice(BigDecimal showTimePrice, BigDecimal seatPrice) {
        CinemaRoom room = CinemaRoom.builder().cinemaRoomId(3L).seatsPerRow(10).build();
        Seat seat = Seat.builder()
                .seatId(1L)
                .seatCode("A1")
                .seatType(SeatType.STANDARD)
                .cinemaRoom(room)
                .price(seatPrice)
                .build();
        room.setSeats(List.of(seat));
        ShowTime showTime = ShowTime.builder()
                .showTimeId(7L)
                .cinemaRoom(room)
                .basePrice(showTimePrice)
                .status(ShowTimeStatus.SCHEDULED)
                .build();

        when(showTimeRepository.findById(7L)).thenReturn(Optional.of(showTime));
        when(showtimeSeatRepository.findByShowTime_ShowTimeId(7L)).thenReturn(List.of());
        when(showtimeSeatRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        List<ShowtimeSeatDto> result = showTimeService.getSeatsByShowtime(7L);
        return result.getFirst().getPrice();
    }

    private ShowtimeSeat showtimeSeat(
            ShowtimeSeatStatus status, BigDecimal price, Seat seat) {
        return ShowtimeSeat.builder()
                .status(status)
                .price(price)
                .seat(seat)
                .seatCode("A1")
                .seatType(SeatType.STANDARD)
                .build();
    }
}
