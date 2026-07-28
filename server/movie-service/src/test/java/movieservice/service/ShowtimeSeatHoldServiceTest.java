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
import java.time.Duration;
import java.util.EnumMap;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import movie.theater.common.exception.AppException;
import movieservice.config.SeatHoldProperties;
import movieservice.dto.request.ConfirmShowtimeSeatHoldRequest;
import movieservice.dto.request.HoldShowtimeSeatsRequest;
import movieservice.dto.response.ShowtimeSeatHoldMutationResponse;
import movieservice.dto.response.ShowtimeSeatHoldResponse;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.SeatType;
import movieservice.enums.SeatHoldChannel;
import movieservice.enums.ShowTimeStatus;
import movieservice.enums.ShowtimeSeatStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeSeatRepository;

@ExtendWith(MockitoExtension.class)
class ShowtimeSeatHoldServiceTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 7, 27, 10, 0);

    @Mock
    ShowTimeRepository showTimeRepository;
    @Mock
    ShowtimeSeatRepository showtimeSeatRepository;
    @Mock
    SeatHoldRateLimitService seatHoldRateLimitService;
    @Mock
    SeatHoldMetrics seatHoldMetrics;
    @Mock
    SeatInventoryOutboxService seatInventoryOutboxService;

    ShowtimeSeatHoldService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(
                Instant.parse("2026-07-27T03:00:00Z"),
                ZoneId.of("Asia/Ho_Chi_Minh"));
        SeatHoldProperties properties = new SeatHoldProperties();
        EnumMap<SeatHoldChannel, Duration> ttlByChannel = new EnumMap<>(SeatHoldChannel.class);
        ttlByChannel.put(SeatHoldChannel.WEB, Duration.ofMinutes(10));
        properties.setTtlByChannel(ttlByChannel);
        service = new ShowtimeSeatHoldService(
                showTimeRepository,
                showtimeSeatRepository,
                clock,
                properties,
                seatHoldRateLimitService,
                seatHoldMetrics,
                seatInventoryOutboxService);
    }

    @Test
    void holdsCompleteSelectionWithOneOwnerAndExpiry() {
        ShowTime showtime = onSaleShowtime();
        List<ShowtimeSeat> seats = List.of(seat(10L, "A1"), seat(11L, "A2"));
        stubLockSelection(showtime, List.of(10L, 11L), List.of("__NO_SEAT_GROUP__"), seats, seats);
        when(showtimeSeatRepository.findByHoldOwnerAndIdempotencyKey(7L, "account-1", "request-1"))
                .thenReturn(List.of());

        ShowtimeSeatHoldResponse result = hold(
                7L,
                new HoldShowtimeSeatsRequest(List.of(11L, 10L)),
                "account-1",
                "request-1");

        assertFalse(result.isReplayed());
        assertEquals(new BigDecimal("180000.00"), result.getTotalPrice());
        assertEquals(NOW.plusMinutes(10), result.getExpiresAt());
        assertTrue(seats.stream().allMatch(value -> value.getStatus() == ShowtimeSeatStatus.RESERVED));
        assertTrue(seats.stream().allMatch(value -> "account-1".equals(value.getReservedBy())));
        assertEquals(1, seats.stream().map(ShowtimeSeat::getHoldId).distinct().count());
        verify(showtimeSeatRepository).saveAllAndFlush(seats);
    }

    @Test
    void expandsCoupleSeatAndHoldsTheWholeGroupAtomically() {
        ShowTime showtime = onSaleShowtime();
        ShowtimeSeat left = seat(20L, "K1");
        ShowtimeSeat right = seat(21L, "K2");
        left.setSeatType(SeatType.COUPLE);
        right.setSeatType(SeatType.COUPLE);
        left.setSeatGroupId("couple-k-1");
        right.setSeatGroupId("couple-k-1");

        stubLockSelection(
                showtime,
                List.of(20L),
                List.of("couple-k-1"),
                List.of(left),
                List.of(left, right));
        when(showtimeSeatRepository.findByHoldOwnerAndIdempotencyKey(7L, "account-1", "couple-request"))
                .thenReturn(List.of());

        ShowtimeSeatHoldResponse result = hold(
                7L,
                new HoldShowtimeSeatsRequest(List.of(20L)),
                "account-1",
                "couple-request");

        assertEquals(List.of(20L, 21L), result.getSeatIds());
        assertEquals(new BigDecimal("180000.00"), result.getTotalPrice());
        assertTrue(List.of(left, right).stream()
                .allMatch(value -> value.getStatus() == ShowtimeSeatStatus.RESERVED));
        assertEquals(left.getHoldId(), right.getHoldId());
    }

    @Test
    void rejectsDuplicateSelectionBeforeDatabaseLock() {
        AppException exception = assertThrows(AppException.class, () -> hold(
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
        List<ShowtimeSeat> seats = List.of(available, sold);
        stubLockSelection(showtime, List.of(10L, 11L), List.of("__NO_SEAT_GROUP__"), seats, seats);
        when(showtimeSeatRepository.findByHoldOwnerAndIdempotencyKey(7L, "account-1", "request-1"))
                .thenReturn(List.of());

        AppException exception = assertThrows(AppException.class, () -> hold(
                7L,
                new HoldShowtimeSeatsRequest(List.of(10L, 11L)),
                "account-1",
                "request-1"));

        assertEquals(MovieErrorCode.SEAT_NOT_AVAILABLE, exception.getErrorCode());
        verify(showtimeSeatRepository, never()).saveAllAndFlush(anyList());
    }

    @Test
    void replaysActiveHoldForSameKeyAndExpandedSelection() {
        ShowTime showtime = onSaleShowtime();
        ShowtimeSeat first = heldSeat(10L, "A1", "hold-1", "account-1", "request-1");
        ShowtimeSeat second = heldSeat(11L, "A2", "hold-1", "account-1", "request-1");
        List<ShowtimeSeat> previous = List.of(first, second);
        stubLockSelection(
                showtime,
                List.of(10L, 11L),
                List.of("__NO_SEAT_GROUP__"),
                previous,
                previous);
        when(showtimeSeatRepository.findByHoldOwnerAndIdempotencyKey(7L, "account-1", "request-1"))
                .thenReturn(previous);

        ShowtimeSeatHoldResponse result = hold(
                7L,
                new HoldShowtimeSeatsRequest(List.of(11L, 10L)),
                "account-1",
                "request-1");

        assertTrue(result.isReplayed());
        assertEquals("hold-1", result.getHoldId());
        verify(showtimeSeatRepository, never()).saveAllAndFlush(anyList());
    }

    @Test
    void releasesOnlyTheOwnersCompleteHold() {
        ShowTime showtime = onSaleShowtime();
        ShowtimeSeat first = heldSeat(10L, "A1", "hold-1", "account-1", "request-1");
        ShowtimeSeat second = heldSeat(11L, "A2", "hold-1", "account-1", "request-1");
        List<ShowtimeSeat> seats = List.of(first, second);
        when(showTimeRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(showtime));
        when(showtimeSeatRepository.findByShowtimeAndHoldIdForUpdate(7L, "hold-1"))
                .thenReturn(seats);

        ShowtimeSeatHoldMutationResponse result = service.release(7L, "hold-1", "account-1");

        assertEquals(ShowtimeSeatStatus.AVAILABLE.name(), result.getStatus());
        assertEquals(List.of(10L, 11L), result.getSeatIds());
        assertTrue(seats.stream().allMatch(value -> value.getStatus() == ShowtimeSeatStatus.AVAILABLE));
        assertTrue(seats.stream().allMatch(value -> value.getHoldId() == null));
        assertTrue(seats.stream().allMatch(value -> value.getReservedBy() == null));
        verify(showtimeSeatRepository).saveAllAndFlush(seats);
    }

    @Test
    void rejectsReleaseFromAnotherOwner() {
        ShowTime showtime = onSaleShowtime();
        ShowtimeSeat held = heldSeat(10L, "A1", "hold-1", "account-1", "request-1");
        when(showTimeRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(showtime));
        when(showtimeSeatRepository.findByShowtimeAndHoldIdForUpdate(7L, "hold-1"))
                .thenReturn(List.of(held));

        AppException exception = assertThrows(
                AppException.class,
                () -> service.release(7L, "hold-1", "account-2"));

        assertEquals(MovieErrorCode.SEAT_HOLD_OWNER_MISMATCH, exception.getErrorCode());
        verify(showtimeSeatRepository, never()).saveAllAndFlush(anyList());
    }

    @Test
    void confirmsActiveHoldAsSoldAndUpdatesShowtimeCounter() {
        ShowTime showtime = onSaleShowtime();
        ShowtimeSeat first = heldSeat(10L, "A1", "hold-1", "account-1", "request-1");
        ShowtimeSeat second = heldSeat(11L, "A2", "hold-1", "account-1", "request-1");
        List<ShowtimeSeat> seats = List.of(first, second);
        when(showTimeRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(showtime));
        when(showtimeSeatRepository.findByShowtimeAndHoldIdForUpdate(7L, "hold-1"))
                .thenReturn(seats);

        ShowtimeSeatHoldMutationResponse result = service.confirm(
                7L,
                "hold-1",
                new ConfirmShowtimeSeatHoldRequest("booking-1"),
                "account-1");

        assertFalse(result.isReplayed());
        assertEquals(ShowtimeSeatStatus.SOLD.name(), result.getStatus());
        assertEquals("booking-1", result.getBookingId());
        assertEquals(2, showtime.getSoldSeats());
        assertTrue(seats.stream().allMatch(value -> value.getStatus() == ShowtimeSeatStatus.SOLD));
        assertTrue(seats.stream().allMatch(value -> "booking-1".equals(value.getBookingId())));
        assertTrue(seats.stream().allMatch(value -> value.getReservedExpiresAt() == null));
        verify(showtimeSeatRepository).saveAllAndFlush(seats);
        verify(showTimeRepository).save(showtime);
    }

    @Test
    void confirmIsIdempotentForTheSameBooking() {
        ShowTime showtime = onSaleShowtime();
        ShowtimeSeat sold = heldSeat(10L, "A1", "hold-1", "account-1", "request-1");
        sold.setStatus(ShowtimeSeatStatus.SOLD);
        sold.setBookingId("booking-1");
        sold.setReservedExpiresAt(null);
        when(showTimeRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(showtime));
        when(showtimeSeatRepository.findByShowtimeAndHoldIdForUpdate(7L, "hold-1"))
                .thenReturn(List.of(sold));

        ShowtimeSeatHoldMutationResponse result = service.confirm(
                7L,
                "hold-1",
                new ConfirmShowtimeSeatHoldRequest("booking-1"),
                "account-1");

        assertTrue(result.isReplayed());
        assertEquals(0, showtime.getSoldSeats());
        verify(showtimeSeatRepository, never()).saveAllAndFlush(anyList());
        verify(showTimeRepository, never()).save(showtime);
    }

    private void stubLockSelection(
            ShowTime showtime,
            List<Long> requestedIds,
            List<String> groupIds,
            List<ShowtimeSeat> requestedSeats,
            List<ShowtimeSeat> lockedSeats) {
        when(showTimeRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(showtime));
        when(showtimeSeatRepository.findAllByShowtimeAndIds(7L, requestedIds))
                .thenReturn(requestedSeats);
        when(showtimeSeatRepository.findSelectionForUpdate(7L, requestedIds, groupIds))
                .thenReturn(lockedSeats);
    }

    private ShowtimeSeatHoldResponse hold(
            Long showtimeId,
            HoldShowtimeSeatsRequest request,
            String ownerId,
            String idempotencyKey) {
        return service.hold(
                showtimeId,
                request,
                ownerId,
                idempotencyKey,
                SeatHoldChannel.WEB,
                "127.0.0.1");
    }

    private ShowTime onSaleShowtime() {
        return ShowTime.builder()
                .showTimeId(7L)
                .status(ShowTimeStatus.ON_SALE)
                .totalSeats(100)
                .soldSeats(0)
                .build();
    }

    private ShowtimeSeat heldSeat(
            Long id,
            String code,
            String holdId,
            String owner,
            String idempotencyKey) {
        ShowtimeSeat value = seat(id, code);
        value.setStatus(ShowtimeSeatStatus.RESERVED);
        value.setReservedAt(NOW.minusMinutes(1));
        value.setReservedExpiresAt(NOW.plusMinutes(5));
        value.setReservedBy(owner);
        value.setHoldId(holdId);
        value.setHoldIdempotencyKey(idempotencyKey);
        return value;
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
