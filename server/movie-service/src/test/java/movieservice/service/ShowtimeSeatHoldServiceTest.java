package movieservice.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.HoldShowtimeSeatsRequest;
import movieservice.dto.response.ShowtimeSeatHoldResponse;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.SeatType;
import movieservice.enums.ShowTimeStatus;
import movieservice.enums.ShowtimeSeatStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeSeatRepository;

@ExtendWith(MockitoExtension.class)
class ShowtimeSeatHoldServiceTest {

    @Mock ShowTimeRepository showTimeRepository;
    @Mock ShowtimeSeatRepository showtimeSeatRepository;

    ShowtimeSeatHoldService service;
    Clock clock;

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(Instant.parse("2026-07-27T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
        service = new ShowtimeSeatHoldService(showTimeRepository, showtimeSeatRepository, clock);
        ReflectionTestUtils.setField(service, "holdTtlSeconds", 600L);
    }

    @Test
    void holdsCompleteSelectionWithOneOwnerAndExpiry() {
        ShowTime showtime = onSaleShowtime();
        List<ShowtimeSeat> seats = List.of(seat(10L, "A1"), seat(11L, "A2"));
        when(showTimeRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(showtime));
        when(showtimeSeatRepository.findByHoldOwnerAndIdempotencyKey(7L, "account-1", "request-1"))
                .thenReturn(List.of());
        when(showtimeSeatRepository.findAllByShowtimeAndIdsForUpdate(7L, List.of(10L, 11L)))
                .thenReturn(seats);

        ShowtimeSeatHoldResponse result = service.hold(
                7L,
                new HoldShowtimeSeatsRequest(List.of(11L, 10L)),
                "account-1",
                "request-1");

        assertFalse(result.isReplayed());
        assertEquals(new BigDecimal("180000.00"), result.getTotalPrice());
        assertEquals(LocalDateTime.of(2026, 7, 27, 10, 10), result.getExpiresAt());
        assertTrue(seats.stream().allMatch(value -> value.getStatus() == ShowtimeSeatStatus.RESERVED));
        assertTrue(seats.stream().allMatch(value -> "account-1".equals(value.getReservedBy())));
        assertTrue(seats.stream().map(ShowtimeSeat::getHoldId).distinct().count() == 1);
        verify(showtimeSeatRepository).saveAllAndFlush(seats);
    }

    @Test
    void rejectsDuplicateSelectionBeforeDatabaseLock() {
        AppException exception = assertThrows(AppException.class, () -> service.hold(
                7L,
                new HoldShowtimeSeatsRequest(List.of(10L, 10L)),
                "account-1",
                "request-1"));

        assertEquals(MovieErrorCode.SEAT_HOLD_SELECTION_INVALID, exception.getErrorCode());
        verify(showTimeRepository, never()).findByIdForUpdate(7L);
    }

    @Test
    void rollsBackSelectionWhenAnySeatIsUnavailable() {
        ShowTime showtime = onSaleShowtime();
        ShowtimeSeat available = seat(10L, "A1");
        ShowtimeSeat sold = seat(11L, "A2");
        sold.setStatus(ShowtimeSeatStatus.SOLD);
        when(showTimeRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(showtime));
        when(showtimeSeatRepository.findByHoldOwnerAndIdempotencyKey(7L, "account-1", "request-1"))
                .thenReturn(List.of());
        when(showtimeSeatRepository.findAllByShowtimeAndIdsForUpdate(7L, List.of(10L, 11L)))
                .thenReturn(List.of(available, sold));

        AppException exception = assertThrows(AppException.class, () -> service.hold(
                7L,
                new HoldShowtimeSeatsRequest(List.of(10L, 11L)),
                "account-1",
                "request-1"));

        assertEquals(MovieErrorCode.SEAT_NOT_AVAILABLE, exception.getErrorCode());
        verify(showtimeSeatRepository, never()).saveAllAndFlush(anyList());
    }

    @Test
    void replaysActiveHoldForSameKeyAndSelection() {
        ShowTime showtime = onSaleShowtime();
        ShowtimeSeat first = seat(10L, "A1");
        ShowtimeSeat second = seat(11L, "A2");
        List<ShowtimeSeat> previous = List.of(first, second);
        previous.forEach(value -> {
            value.setStatus(ShowtimeSeatStatus.RESERVED);
            value.setReservedBy("account-1");
            value.setHoldId("hold-1");
            value.setHoldIdempotencyKey("request-1");
            value.setReservedExpiresAt(LocalDateTime.of(2026, 7, 27, 10, 5));
        });
        when(showTimeRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(showtime));
        when(showtimeSeatRepository.findByHoldOwnerAndIdempotencyKey(7L, "account-1", "request-1"))
                .thenReturn(previous);

        ShowtimeSeatHoldResponse result = service.hold(
                7L,
                new HoldShowtimeSeatsRequest(List.of(11L, 10L)),
                "account-1",
                "request-1");

        assertTrue(result.isReplayed());
        assertEquals("hold-1", result.getHoldId());
        verify(showtimeSeatRepository, never()).findAllByShowtimeAndIdsForUpdate(7L, List.of(10L, 11L));
        verify(showtimeSeatRepository, never()).saveAllAndFlush(anyList());
    }

    private ShowTime onSaleShowtime() {
        return ShowTime.builder()
                .showTimeId(7L)
                .status(ShowTimeStatus.ON_SALE)
                .build();
    }

    private ShowtimeSeat seat(Long id, String code) {
        return ShowtimeSeat.builder()
                .showtimeSeatId(id)
                .seatCode(code)
                .seatType(SeatType.STANDARD)
                .price(new BigDecimal("90000.00"))
                .status(ShowtimeSeatStatus.AVAILABLE)
                .build();
    }
}
