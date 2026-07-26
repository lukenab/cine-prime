package movieservice.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.HoldShowtimeSeatsRequest;
import movieservice.dto.response.HeldShowtimeSeatResponse;
import movieservice.dto.response.ShowtimeSeatHoldResponse;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.ShowTimeStatus;
import movieservice.enums.ShowtimeSeatStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeSeatRepository;

/**
 * Authoritative temporary-hold boundary for showtime inventory.
 *
 * <p>The showtime row is locked first to serialize idempotency checks for one
 * inventory partition. Requested seat rows are then locked in stable ID order.
 * The transaction either reserves the entire selection or changes nothing.</p>
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ShowtimeSeatHoldService {

    ShowTimeRepository showTimeRepository;
    ShowtimeSeatRepository showtimeSeatRepository;
    Clock clock;

    @NonFinal
    @Value("${showtime.seat-hold.ttl-seconds:600}")
    long holdTtlSeconds;

    @Transactional
    public ShowtimeSeatHoldResponse hold(
            Long showtimeId,
            HoldShowtimeSeatsRequest request,
            String ownerId,
            String idempotencyKey) {
        validateIdentity(ownerId, idempotencyKey);
        List<Long> requestedIds = normalizeSeatIds(request);

        ShowTime showtime = showTimeRepository.findByIdForUpdate(showtimeId)
                .filter(value -> value.getStatus() == ShowTimeStatus.ON_SALE)
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND));

        LocalDateTime now = LocalDateTime.now(clock);
        List<ShowtimeSeat> previousAttempt = showtimeSeatRepository
                .findByHoldOwnerAndIdempotencyKey(showtimeId, ownerId, idempotencyKey);
        if (!previousAttempt.isEmpty()) {
            return replayExistingHold(showtime, requestedIds, previousAttempt, now);
        }

        List<ShowtimeSeat> seats = showtimeSeatRepository
                .findAllByShowtimeAndIdsForUpdate(showtimeId, requestedIds);
        if (seats.size() != requestedIds.size()) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_SELECTION_INVALID);
        }

        for (ShowtimeSeat seat : seats) {
            if (seat.getStatus() == ShowtimeSeatStatus.RESERVED
                    && seat.getReservedExpiresAt() != null
                    && !seat.getReservedExpiresAt().isAfter(now)) {
                clearExpiredHold(seat);
            }
            if (seat.getStatus() != ShowtimeSeatStatus.AVAILABLE) {
                throw new AppException(MovieErrorCode.SEAT_NOT_AVAILABLE);
            }
        }

        String holdId = UUID.randomUUID().toString();
        LocalDateTime expiresAt = now.plusSeconds(holdTtlSeconds);
        seats.forEach(seat -> {
            seat.setStatus(ShowtimeSeatStatus.RESERVED);
            seat.setReservedAt(now);
            seat.setReservedExpiresAt(expiresAt);
            seat.setHoldId(holdId);
            seat.setReservedBy(ownerId);
            seat.setHoldIdempotencyKey(idempotencyKey);
        });
        showtimeSeatRepository.saveAllAndFlush(seats);

        return toResponse(showtimeId, seats, expiresAt, false);
    }

    @Transactional
    public int releaseExpiredHolds() {
        return showtimeSeatRepository.releaseExpiredReservations(LocalDateTime.now(clock));
    }

    private ShowtimeSeatHoldResponse replayExistingHold(
            ShowTime showtime,
            List<Long> requestedIds,
            List<ShowtimeSeat> previousAttempt,
            LocalDateTime now) {
        Set<Long> previousIds = previousAttempt.stream()
                .map(ShowtimeSeat::getShowtimeSeatId)
                .collect(java.util.stream.Collectors.toSet());
        if (!previousIds.equals(new HashSet<>(requestedIds))) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_IDEMPOTENCY_CONFLICT);
        }

        boolean active = previousAttempt.stream().allMatch(seat ->
                seat.getStatus() == ShowtimeSeatStatus.RESERVED
                        && seat.getHoldId() != null
                        && seat.getReservedExpiresAt() != null
                        && seat.getReservedExpiresAt().isAfter(now));
        if (!active) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_EXPIRED);
        }

        return toResponse(
                showtime.getShowTimeId(),
                previousAttempt,
                previousAttempt.get(0).getReservedExpiresAt(),
                true);
    }

    private List<Long> normalizeSeatIds(HoldShowtimeSeatsRequest request) {
        if (request == null || request.getSeatIds() == null || request.getSeatIds().isEmpty()
                || request.getSeatIds().size() > 8
                || request.getSeatIds().stream().anyMatch(id -> id == null || id <= 0)
                || request.getSeatIds().stream().distinct().count() != request.getSeatIds().size()) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_SELECTION_INVALID);
        }
        return request.getSeatIds().stream().sorted().toList();
    }

    private void validateIdentity(String ownerId, String idempotencyKey) {
        if (ownerId == null || ownerId.isBlank()) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_OWNER_REQUIRED);
        }
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 128) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_IDEMPOTENCY_KEY_REQUIRED);
        }
    }

    private void clearExpiredHold(ShowtimeSeat seat) {
        seat.setStatus(ShowtimeSeatStatus.AVAILABLE);
        seat.setReservedAt(null);
        seat.setReservedExpiresAt(null);
        seat.setHoldId(null);
        seat.setReservedBy(null);
        seat.setHoldIdempotencyKey(null);
    }

    private ShowtimeSeatHoldResponse toResponse(
            Long showtimeId,
            List<ShowtimeSeat> seats,
            LocalDateTime expiresAt,
            boolean replayed) {
        List<HeldShowtimeSeatResponse> heldSeats = new ArrayList<>();
        BigDecimal totalPrice = BigDecimal.ZERO;
        for (ShowtimeSeat seat : seats) {
            heldSeats.add(HeldShowtimeSeatResponse.builder()
                    .seatId(seat.getShowtimeSeatId())
                    .seatCode(seat.getSeatCode())
                    .seatType(seat.getSeatType() == null ? null : seat.getSeatType().name())
                    .price(seat.getPrice())
                    .build());
            totalPrice = totalPrice.add(seat.getPrice());
        }
        return ShowtimeSeatHoldResponse.builder()
                .holdId(seats.get(0).getHoldId())
                .showtimeId(showtimeId)
                .seatIds(seats.stream().map(ShowtimeSeat::getShowtimeSeatId).toList())
                .seats(heldSeats)
                .totalPrice(totalPrice)
                .expiresAt(expiresAt)
                .replayed(replayed)
                .build();
    }
}
