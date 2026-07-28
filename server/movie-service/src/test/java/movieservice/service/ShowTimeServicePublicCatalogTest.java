package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.response.ShowTimeResponse;
import movieservice.entity.ShowTime;
import movieservice.enums.ShowTimeStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.repository.SeatRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeSeatRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShowTimeServicePublicCatalogTest {

    @Mock ShowTimeRepository showTimeRepository;
    @Mock ShowtimeSeatRepository showtimeSeatRepository;
    @Mock SeatRepository seatRepository;
    @Mock MovieRepository movieRepository;
    @Mock CinemaRoomRepository cinemaRoomRepository;
    @Mock RoomLayoutRepository roomLayoutRepository;
    @Mock MovieMapper movieMapper;
    @Mock ShowtimeInventoryService showtimeInventoryService;

    @InjectMocks
    ShowTimeService showTimeService;

    @Test
    void publicListQueriesOnlyOnSaleShowtimes() {
        ShowTime onSale = ShowTime.builder().showTimeId(21L).status(ShowTimeStatus.ON_SALE).build();
        ShowTimeResponse response = new ShowTimeResponse();
        response.setShowTimeId(21L);
        response.setStatus("ON_SALE");
        when(showTimeRepository.findAllByStatusOrderByShowDateAscStartTimeAsc(ShowTimeStatus.ON_SALE))
                .thenReturn(List.of(onSale));
        when(movieMapper.toShowTimeResponseList(List.of(onSale))).thenReturn(List.of(response));

        List<ShowTimeResponse> result = showTimeService.getPublicOnSale();

        assertEquals(1, result.size());
        assertEquals("ON_SALE", result.getFirst().getStatus());
        verify(showTimeRepository)
                .findAllByStatusOrderByShowDateAscStartTimeAsc(ShowTimeStatus.ON_SALE);
    }

    @Test
    void publicMovieScheduleQueriesOnlyOnSaleShowtimes() {
        LocalDate date = LocalDate.of(2026, 7, 26);
        ShowTime onSale = ShowTime.builder().showTimeId(22L).status(ShowTimeStatus.ON_SALE).build();
        when(movieRepository.existsById(7L)).thenReturn(true);
        when(showTimeRepository.findByMovieMovieIdAndShowDateAndStatusOrderByStartTimeAsc(
                7L, date, ShowTimeStatus.ON_SALE)).thenReturn(List.of(onSale));
        when(movieMapper.toShowTimeResponseList(List.of(onSale))).thenReturn(List.of(new ShowTimeResponse()));

        showTimeService.getPublicOnSaleByMovieId(7L, date);

        verify(showTimeRepository).findByMovieMovieIdAndShowDateAndStatusOrderByStartTimeAsc(
                7L, date, ShowTimeStatus.ON_SALE);
    }

    @Test
    void scheduledShowtimeCannotExposePublicSeatMap() {
        when(showTimeRepository.findByShowTimeIdAndStatus(23L, ShowTimeStatus.ON_SALE))
                .thenReturn(Optional.empty());

        AppException exception = assertThrows(
                AppException.class,
                () -> showTimeService.getSeatsByShowtime(23L));

        assertEquals(MovieErrorCode.SHOWTIME_NOT_FOUND, exception.getErrorCode());
    }
}
