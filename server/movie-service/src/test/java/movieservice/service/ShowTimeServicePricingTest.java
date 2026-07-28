package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.CreateShowTimeRequest;
import movieservice.dto.request.UpdateShowTimeRequest;
import movieservice.dto.response.ShowTimePricingResponse;
import movieservice.dto.response.ShowtimeSeatMapResponse;
import movieservice.dto.response.ShowtimeSeatDto;
import movieservice.entity.CinemaRoom;
import movieservice.entity.CinemaCluster;
import movieservice.entity.Movie;
import movieservice.entity.RoomLayout;
import movieservice.entity.RoomLayoutPosition;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.SeatType;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.ClusterStatus;
import movieservice.enums.LayoutStatus;
import movieservice.enums.LayoutPositionType;
import movieservice.enums.ShowTimeStatus;
import movieservice.enums.ShowtimeSeatStatus;
import movieservice.mapper.MovieMapper;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.repository.RoomLayoutPositionRepository;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShowTimeServicePricingTest {

    @Mock ShowTimeRepository showTimeRepository;
    @Mock ShowtimeSeatRepository showtimeSeatRepository;
    @Mock SeatRepository seatRepository;
    @Mock MovieRepository movieRepository;
    @Mock CinemaRoomRepository cinemaRoomRepository;
    @Mock RoomLayoutRepository roomLayoutRepository;
    @Mock RoomLayoutPositionRepository roomLayoutPositionRepository;
    @Mock MovieMapper movieMapper;
    @Mock ShowtimeInventoryService showtimeInventoryService;
    @Mock PriceBookPricingService priceBookPricingService;

    @InjectMocks
    ShowTimeService showTimeService;

    @Test
    void seatReadRejectsMissingInventoryWithoutCreatingRows() {
        when(showTimeRepository.findByShowTimeIdAndStatus(7L, ShowTimeStatus.ON_SALE))
                .thenReturn(Optional.of(ShowTime.builder().showTimeId(7L).build()));
        when(showtimeSeatRepository.findByShowTime_ShowTimeId(7L)).thenReturn(List.of());

        AppException exception = assertThrows(
                AppException.class, () -> showTimeService.getSeatsByShowtime(7L));

        assertEquals(MovieErrorCode.SHOWTIME_INVENTORY_NOT_MATERIALIZED, exception.getErrorCode());
        verify(showtimeSeatRepository, never()).saveAll(anyList());
    }

    @Test
    void seatMapReturnsInventoryAlongsideTheSnappedPhysicalLayout() {
        CinemaRoom room = CinemaRoom.builder().cinemaRoomId(3L).build();
        ShowTime showtime = ShowTime.builder()
                .showTimeId(7L)
                .status(ShowTimeStatus.ON_SALE)
                .cinemaRoom(room)
                .build();
        RoomLayout layout = RoomLayout.builder().roomLayoutId(11L).build();
        ShowtimeSeat inventory = ShowtimeSeat.builder()
                .showtimeSeatId(71L)
                .showTime(showtime)
                .roomLayout(layout)
                .seatCode("A1")
                .seatType(SeatType.STANDARD)
                .status(ShowtimeSeatStatus.AVAILABLE)
                .price(new BigDecimal("90000.00"))
                .build();
        RoomLayoutPosition position = RoomLayoutPosition.builder()
                .positionId(101L)
                .rowIndex(0)
                .columnIndex(0)
                .rowLabel("A")
                .positionType(LayoutPositionType.SEAT)
                .seatNumber(1)
                .seatCode("A1")
                .seatType(SeatType.STANDARD)
                .build();
        RoomLayoutPosition aisle = RoomLayoutPosition.builder()
                .positionId(102L)
                .rowIndex(0)
                .columnIndex(1)
                .rowLabel("A")
                .positionType(LayoutPositionType.AISLE)
                .seatStatus(null)
                .build();

        when(showTimeRepository.findByShowTimeIdAndStatus(7L, ShowTimeStatus.ON_SALE))
                .thenReturn(Optional.of(showtime));
        when(showtimeSeatRepository.findByShowTime_ShowTimeId(7L)).thenReturn(List.of(inventory));
        when(roomLayoutPositionRepository.findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(11L))
                .thenReturn(List.of(position, aisle));

        ShowtimeSeatMapResponse result = showTimeService.getSeatMapByShowtime(7L);

        assertEquals("A1", result.getSeats().getFirst().getSeatCode());
        assertEquals("SEAT", result.getPositions().getFirst().getPositionType());
        assertEquals("A", result.getPositions().getFirst().getRowLabel());
        assertEquals("AISLE", result.getPositions().get(1).getPositionType());
        assertNull(result.getPositions().get(1).getSeatStatus());
    }

    @Test
    void createPersistsAndReturnsBasePrice() {
        Movie movie = Movie.builder().movieId(1L).originalTitle("Movie").durationMinutes(90).build();
        CinemaRoom room = CinemaRoom.builder()
                .cinemaRoomId(3L)
                .cinemaRoomName("Room 3")
                .totalSeatCapacity(20)
                .status(CinemaRoomStatus.ACTIVE)
                .cluster(activeCluster())
                .build();
        CreateShowTimeRequest request = new CreateShowTimeRequest();
        request.setMovieId(1L);
        request.setCinemaRoomId(3L);
        request.setShowDate(LocalDate.now().plusDays(3));
        request.setStartTime(LocalTime.of(14, 30));
        request.setBasePrice(new BigDecimal("120000.00"));

        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(cinemaRoomRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(room));
        allowActiveLayout(3L);
        when(showTimeRepository.existsByCinemaRoomAndOverlappingTime(
                any(), any(), any(), any())).thenReturn(false);
        when(showTimeRepository.saveAndFlush(any(ShowTime.class))).thenAnswer(invocation -> {
            ShowTime value = invocation.getArgument(0);
            value.setShowTimeId(55L);
            return value;
        });

        ShowTimePricingResponse response = showTimeService.createStandalone(request);

        assertEquals(new BigDecimal("120000.00"), response.getBasePrice());
        assertEquals(55L, response.getShowTimeId());
        verify(showtimeInventoryService).materialize(55L);
    }

    @Test
    void createWithoutBasePricePersistsNullForSeatPriceFallback() {
        Movie movie = Movie.builder().movieId(1L).durationMinutes(90).build();
        CinemaRoom room = CinemaRoom.builder()
                .cinemaRoomId(3L)
                .totalSeatCapacity(20)
                .status(CinemaRoomStatus.ACTIVE)
                .cluster(activeCluster())
                .build();
        CreateShowTimeRequest request = new CreateShowTimeRequest();
        request.setMovieId(1L);
        request.setCinemaRoomId(3L);
        request.setShowDate(LocalDate.now().plusDays(3));
        request.setStartTime(LocalTime.of(14, 30));

        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(cinemaRoomRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(room));
        allowActiveLayout(3L);
        when(showTimeRepository.existsByCinemaRoomAndOverlappingTime(
                any(), any(), any(), any())).thenReturn(false);
        when(showTimeRepository.saveAndFlush(any(ShowTime.class)))
                .thenAnswer(invocation -> {
                    ShowTime value = invocation.getArgument(0);
                    value.setShowTimeId(56L);
                    return value;
                });

        ShowTimePricingResponse response = showTimeService.createStandalone(request);

        assertNull(response.getBasePrice());
    }

    @Test
    void createRejectsRoomWithoutActiveSellableLayout() {
        Movie movie = Movie.builder().movieId(1L).durationMinutes(90).build();
        CinemaRoom room = CinemaRoom.builder()
                .cinemaRoomId(3L)
                .totalSeatCapacity(20)
                .status(CinemaRoomStatus.ACTIVE)
                .cluster(activeCluster())
                .build();
        CreateShowTimeRequest request = new CreateShowTimeRequest();
        request.setMovieId(1L);
        request.setCinemaRoomId(3L);
        request.setShowDate(LocalDate.now().plusDays(3));
        request.setStartTime(LocalTime.of(14, 30));

        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(cinemaRoomRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(room));

        AppException exception = assertThrows(
                AppException.class, () -> showTimeService.createStandalone(request));

        assertEquals(MovieErrorCode.SHOWTIME_ROOM_NOT_SCHEDULABLE, exception.getErrorCode());
        verify(showTimeRepository, never()).save(any(ShowTime.class));
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
        stubPricingDecision(
                showTime,
                PriceBookPricingService.PricingDecision.override(
                        new BigDecimal("130000.00")));
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
        stubPricingDecision(
                showTime,
                PriceBookPricingService.PricingDecision.roomDefault(
                        new BigDecimal("90000.00")));
        when(showtimeSeatRepository.findByShowTime_ShowTimeId(7L))
                .thenReturn(List.of(available, reserved, sold));

        ShowTimePricingResponse response = showTimeService.update(7L, request);

        assertEquals(new BigDecimal("90000.00"), response.getBasePrice());
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

    private void stubPricingDecision(
            ShowTime showTime,
            PriceBookPricingService.PricingDecision decision) {
        when(priceBookPricingService.resolve(showTime)).thenReturn(decision);
        doAnswer(invocation -> {
            ShowTime target = invocation.getArgument(0);
            PriceBookPricingService.PricingDecision resolved = invocation.getArgument(1);
            target.setBasePrice(resolved.standardPrice());
            target.setPriceSource(resolved.source());
            target.setPriceBook(resolved.priceBook());
            target.setPriceRate(resolved.priceRate());
            return null;
        }).when(priceBookPricingService).applyDecision(showTime, decision);
    }

    @Test
    void updateRejectsPriceChangeAfterShowtimeOpensForSales() {
        ShowTime showTime = ShowTime.builder()
                .showTimeId(7L)
                .status(ShowTimeStatus.ON_SALE)
                .basePrice(new BigDecimal("120000.00"))
                .build();
        UpdateShowTimeRequest request = new UpdateShowTimeRequest();
        request.setBasePrice(new BigDecimal("130000.00"));
        when(showTimeRepository.findById(7L)).thenReturn(Optional.of(showTime));

        AppException exception = assertThrows(
                AppException.class, () -> showTimeService.update(7L, request));

        assertEquals(MovieErrorCode.SHOWTIME_PRICE_LOCKED, exception.getErrorCode());
        verify(showTimeRepository, never()).save(any(ShowTime.class));
        verify(showtimeSeatRepository, never()).saveAll(anyList());
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

    private CinemaCluster activeCluster() {
        return CinemaCluster.builder().clusterId(1L).status(ClusterStatus.ACTIVE).build();
    }

    private void allowActiveLayout(Long roomId) {
        RoomLayout layout = RoomLayout.builder()
                .status(LayoutStatus.ACTIVE)
                .personCapacity(20)
                .sellableUnitCount(20)
                .build();
        when(roomLayoutRepository.findByCinemaRoomCinemaRoomIdAndStatus(roomId, LayoutStatus.ACTIVE))
                .thenReturn(Optional.of(layout));
    }
}
