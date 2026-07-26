package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.BulkUpdateShowTimeStatusRequest;
import movieservice.dto.request.UpdateShowTimeStatusRequest;
import movieservice.dto.response.ShowTimeResponse;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.ShowTimeStatus;
import movieservice.enums.ShowtimeSeatStatus;
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

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShowTimeServiceLifecycleTest {

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
    void opensSalesFromScheduledState() {
        ShowTime showTime = showtime(11L, ShowTimeStatus.SCHEDULED);
        when(showTimeRepository.findById(11L)).thenReturn(Optional.of(showTime));
        when(showTimeRepository.save(showTime)).thenReturn(showTime);

        ShowTimeResponse response = showTimeService.updateStatus(
                11L,
                new UpdateShowTimeStatusRequest(ShowTimeStatus.ON_SALE, null),
                "admin-7");

        assertEquals("ON_SALE", response.getStatus());
        assertEquals(ShowTimeStatus.ON_SALE, showTime.getStatus());
        assertEquals("admin-7", showTime.getUpdatedBy());
        verify(showtimeInventoryService).materialize(11L);
    }

    @Test
    void cancellationRequiresOperationalReason() {
        ShowTime showTime = showtime(12L, ShowTimeStatus.ON_SALE);
        when(showTimeRepository.findById(12L)).thenReturn(Optional.of(showTime));

        AppException exception = assertThrows(
                AppException.class,
                () -> showTimeService.updateStatus(
                        12L,
                        new UpdateShowTimeStatusRequest(ShowTimeStatus.CANCELLED, " "),
                        "admin-7"));

        assertEquals(MovieErrorCode.SHOWTIME_CANCELLATION_REASON_REQUIRED, exception.getErrorCode());
        verify(showTimeRepository, never()).save(any());
    }

    @Test
    void cancellationClosesInventoryAndRecordsActor() {
        ShowTime showTime = showtime(13L, ShowTimeStatus.ON_SALE);
        ShowtimeSeat available = ShowtimeSeat.builder()
                .status(ShowtimeSeatStatus.AVAILABLE)
                .build();
        ShowtimeSeat reserved = ShowtimeSeat.builder()
                .status(ShowtimeSeatStatus.RESERVED)
                .build();
        when(showTimeRepository.findById(13L)).thenReturn(Optional.of(showTime));
        when(showtimeSeatRepository.findByShowTime_ShowTimeId(13L))
                .thenReturn(List.of(available, reserved));
        when(showTimeRepository.save(showTime)).thenReturn(showTime);

        showTimeService.updateStatus(
                13L,
                new UpdateShowTimeStatusRequest(ShowTimeStatus.CANCELLED, "Room maintenance"),
                "admin-9");

        assertEquals(ShowTimeStatus.CANCELLED, showTime.getStatus());
        assertEquals("Room maintenance", showTime.getCancellationReason());
        assertEquals("admin-9", showTime.getCancelledBy());
        assertTrue(showTime.getCancelledAt() != null);
        assertTrue(List.of(available, reserved).stream()
                .allMatch(seat -> seat.getStatus() == ShowtimeSeatStatus.CANCELLED));
        verify(showtimeSeatRepository).saveAll(List.of(available, reserved));
    }

    @Test
    void bulkUpdateRejectsMissingIdsBeforeChangingAnything() {
        ShowTime one = showtime(21L, ShowTimeStatus.SCHEDULED);
        when(showTimeRepository.findAllById(List.of(21L, 22L))).thenReturn(List.of(one));

        AppException exception = assertThrows(
                AppException.class,
                () -> showTimeService.bulkUpdateStatus(
                        new BulkUpdateShowTimeStatusRequest(
                                List.of(22L, 21L),
                                ShowTimeStatus.ON_SALE,
                                null),
                        "admin-1"));

        assertEquals(MovieErrorCode.SHOWTIME_NOT_FOUND, exception.getErrorCode());
        assertEquals(ShowTimeStatus.SCHEDULED, one.getStatus());
        verify(showTimeRepository, never()).saveAll(any());
    }

    @Test
    void terminalShowtimeCannotBeReopened() {
        ShowTime showTime = showtime(31L, ShowTimeStatus.CANCELLED);
        when(showTimeRepository.findById(31L)).thenReturn(Optional.of(showTime));

        AppException exception = assertThrows(
                AppException.class,
                () -> showTimeService.updateStatus(
                        31L,
                        new UpdateShowTimeStatusRequest(ShowTimeStatus.ON_SALE, null),
                        "admin-1"));

        assertEquals(MovieErrorCode.SHOWTIME_TERMINAL_STATUS, exception.getErrorCode());
    }

    private ShowTime showtime(Long id, ShowTimeStatus status) {
        return ShowTime.builder()
                .showTimeId(id)
                .status(status)
                .build();
    }
}
