package movieservice.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.exception.AppException;
import movieservice.config.SeatHoldProperties;
import movieservice.dto.request.ConfirmShowtimeSeatHoldRequest;
import movieservice.dto.request.HoldShowtimeSeatsRequest;
import movieservice.dto.response.HeldShowtimeSeatResponse;
import movieservice.dto.response.SeatHoldPolicyResponse;
import movieservice.dto.response.ShowtimeSeatHoldMutationResponse;
import movieservice.dto.response.ShowtimeSeatHoldResponse;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.SeatHoldChannel;
import movieservice.enums.SeatInventoryEventType;
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

    private static final String NO_SEAT_GROUP_SENTINEL = "__NO_SEAT_GROUP__";

    ShowTimeRepository showTimeRepository;
    ShowtimeSeatRepository showtimeSeatRepository;
    Clock clock;
    SeatHoldProperties properties;
    SeatHoldRateLimitService rateLimitService;
    SeatHoldMetrics metrics;
    SeatInventoryOutboxService outboxService;

    @Transactional
    public ShowtimeSeatHoldResponse hold(
            Long showtimeId,
            HoldShowtimeSeatsRequest request,
            String ownerId,
            String idempotencyKey,
            SeatHoldChannel channel,
            String clientIp) {
        validateIdentity(ownerId, idempotencyKey);
        rateLimitService.check(ownerId, clientIp, showtimeId);
        List<Long> requestedIds = normalizeSeatIds(request);

        ShowTime showtime = showTimeRepository.findByIdForUpdate(showtimeId)
                .filter(value -> value.getStatus() == ShowTimeStatus.ON_SALE)
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND));

        List<ShowtimeSeat> requestedSeats = showtimeSeatRepository
                .findAllByShowtimeAndIds(showtimeId, requestedIds);
        if (requestedSeats.size() != requestedIds.size()) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_SELECTION_INVALID);
        }

        List<String> groupIds = requestedSeats.stream()
                .map(ShowtimeSeat::getSeatGroupId)
                .filter(value -> value != null && !value.isBlank())
                .distinct()
                .sorted()
                .toList();
        List<ShowtimeSeat> seats = showtimeSeatRepository.findSelectionForUpdate(
                showtimeId,
                requestedIds,
                groupIds.isEmpty() ? List.of(NO_SEAT_GROUP_SENTINEL) : groupIds);
        validateExpandedSelection(requestedIds, seats);

        LocalDateTime now = LocalDateTime.now(clock);
        List<ShowtimeSeat> previousAttempt = showtimeSeatRepository
                .findByHoldOwnerAndIdempotencyKey(showtimeId, ownerId, idempotencyKey);
        if (!previousAttempt.isEmpty()) {
            return replayExistingHold(showtime, seats, previousAttempt, now);
        }

        for (ShowtimeSeat seat : seats) {
            if (seat.getStatus() == ShowtimeSeatStatus.RESERVED
                    && seat.getReservedExpiresAt() != null
                    && !seat.getReservedExpiresAt().isAfter(now)) {
                clearExpiredHold(seat);
            }
            if (seat.getStatus() != ShowtimeSeatStatus.AVAILABLE) {
                metrics.conflict();
                throw new AppException(MovieErrorCode.SEAT_NOT_AVAILABLE);
            }
        }

        String holdId = UUID.randomUUID().toString();
        LocalDateTime expiresAt = now.plus(properties.ttlFor(channel));
        seats.forEach(seat -> {
            seat.setStatus(ShowtimeSeatStatus.RESERVED);
            seat.setReservedAt(now);
            seat.setReservedExpiresAt(expiresAt);
            seat.setHoldId(holdId);
            seat.setReservedBy(ownerId);
            seat.setHoldIdempotencyKey(idempotencyKey);
        });
        showtimeSeatRepository.saveAllAndFlush(seats);
        List<Long> seatIds = seats.stream().map(ShowtimeSeat::getShowtimeSeatId).toList();
        outboxService.record(
                SeatInventoryEventType.HELD,
                showtimeId,
                holdId,
                seatIds,
                expiresAt,
                null);
        metrics.created();

        return toResponse(showtimeId, seats, expiresAt, false);
    }

    public SeatHoldPolicyResponse policy(SeatHoldChannel channel) {
        return SeatHoldPolicyResponse.builder()
                .channel(channel.name())
                .ttlSeconds(properties.ttlFor(channel).toSeconds())
                .maxSeatsPerBooking(properties.getMaxSeatsPerBooking())
                .build();
    }

    /**
     * Releases an active hold owned by the authenticated account. This is the
     * compensation boundary used when booking creation fails after the remote
     * inventory transaction has succeeded.
     */
    @Transactional
    public ShowtimeSeatHoldMutationResponse release(Long showtimeId, String holdId, String ownerId) {
        validateHoldMutationIdentity(holdId, ownerId);
        showTimeRepository.findByIdForUpdate(showtimeId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND));

        List<ShowtimeSeat> seats = showtimeSeatRepository
                .findByShowtimeAndHoldIdForUpdate(showtimeId, holdId);
        if (seats.isEmpty()) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_NOT_FOUND);
        }
        validateHoldOwner(seats, ownerId);
        if (seats.stream().anyMatch(seat -> seat.getStatus() == ShowtimeSeatStatus.SOLD)) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_ALREADY_SOLD);
        }
        if (seats.stream().anyMatch(seat -> seat.getStatus() != ShowtimeSeatStatus.RESERVED)) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_NOT_FOUND);
        }

        List<Long> seatIds = seats.stream().map(ShowtimeSeat::getShowtimeSeatId).toList();
        seats.forEach(this::clearHold);
        showtimeSeatRepository.saveAllAndFlush(seats);
        outboxService.record(
                SeatInventoryEventType.RELEASED,
                showtimeId,
                holdId,
                seatIds,
                null,
                null);
        metrics.released();

        return ShowtimeSeatHoldMutationResponse.builder()
                .holdId(holdId)
                .showtimeId(showtimeId)
                .seatIds(seatIds)
                .status(ShowtimeSeatStatus.AVAILABLE.name())
                .replayed(false)
                .build();
    }

    /**
     * Converts the complete hold to SOLD atomically after a booking/payment
     * authority supplies its stable booking identifier.
     */
    @Transactional
    public ShowtimeSeatHoldMutationResponse confirm(
            Long showtimeId,
            String holdId,
            ConfirmShowtimeSeatHoldRequest request,
            String ownerId) {
        validateHoldMutationIdentity(holdId, ownerId);
        ShowTime showtime = showTimeRepository.findByIdForUpdate(showtimeId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND));
        List<ShowtimeSeat> seats = showtimeSeatRepository
                .findByShowtimeAndHoldIdForUpdate(showtimeId, holdId);
        if (seats.isEmpty()) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_NOT_FOUND);
        }
        validateHoldOwner(seats, ownerId);

        String bookingId = request.getBookingId();
        boolean replayed = seats.stream().allMatch(seat ->
                seat.getStatus() == ShowtimeSeatStatus.SOLD
                        && bookingId.equals(seat.getBookingId()));
        if (replayed) {
            return toMutationResponse(showtimeId, holdId, seats, bookingId, true);
        }
        if (seats.stream().anyMatch(seat -> seat.getStatus() == ShowtimeSeatStatus.SOLD)) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_ALREADY_SOLD);
        }

        LocalDateTime now = LocalDateTime.now(clock);
        boolean active = seats.stream().allMatch(seat ->
                seat.getStatus() == ShowtimeSeatStatus.RESERVED
                        && seat.getReservedExpiresAt() != null
                        && seat.getReservedExpiresAt().isAfter(now));
        if (!active) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_EXPIRED);
        }

        seats.forEach(seat -> {
            seat.setStatus(ShowtimeSeatStatus.SOLD);
            seat.setBookingId(bookingId);
            seat.setReservedExpiresAt(null);
        });
        int soldSeats = showtime.getSoldSeats() == null ? 0 : showtime.getSoldSeats();
        int totalSeats = showtime.getTotalSeats() == null ? Integer.MAX_VALUE : showtime.getTotalSeats();
        if (soldSeats + seats.size() > totalSeats) {
            throw new AppException(MovieErrorCode.SEAT_NOT_AVAILABLE);
        }
        showtime.setSoldSeats(soldSeats + seats.size());
        showtimeSeatRepository.saveAllAndFlush(seats);
        showTimeRepository.save(showtime);
        List<Long> seatIds = seats.stream().map(ShowtimeSeat::getShowtimeSeatId).toList();
        outboxService.record(
                SeatInventoryEventType.SOLD,
                showtimeId,
                holdId,
                seatIds,
                null,
                bookingId);
        metrics.sold();

        return toMutationResponse(showtimeId, holdId, seats, bookingId, false);
    }

    @Transactional
    public int releaseExpiredHolds() {
        List<ShowtimeSeat> expiredSeats = showtimeSeatRepository
                .findExpiredReservationsForUpdate(LocalDateTime.now(clock));
        if (expiredSeats.isEmpty()) {
            return 0;
        }

        Map<String, List<ShowtimeSeat>> holds = new LinkedHashMap<>();
        for (ShowtimeSeat seat : expiredSeats) {
            String key = seat.getShowTime().getShowTimeId() + ":" + seat.getHoldId();
            holds.computeIfAbsent(key, ignored -> new ArrayList<>()).add(seat);
        }

        for (List<ShowtimeSeat> heldSeats : holds.values()) {
            ShowtimeSeat first = heldSeats.get(0);
            Long showtimeId = first.getShowTime().getShowTimeId();
            String holdId = first.getHoldId();
            List<Long> seatIds = heldSeats.stream().map(ShowtimeSeat::getShowtimeSeatId).toList();
            heldSeats.forEach(this::clearHold);
            outboxService.record(
                    SeatInventoryEventType.RELEASED,
                    showtimeId,
                    holdId,
                    seatIds,
                    null,
                    null);
            metrics.expired();
        }
        showtimeSeatRepository.saveAllAndFlush(expiredSeats);
        return holds.size();
    }

    private ShowtimeSeatHoldResponse replayExistingHold(
            ShowTime showtime,
            List<ShowtimeSeat> expandedSelection,
            List<ShowtimeSeat> previousAttempt,
            LocalDateTime now) {
        Set<Long> previousIds = previousAttempt.stream()
                .map(ShowtimeSeat::getShowtimeSeatId)
                .collect(java.util.stream.Collectors.toSet());
        Set<Long> expandedIds = expandedSelection.stream()
                .map(ShowtimeSeat::getShowtimeSeatId)
                .collect(java.util.stream.Collectors.toSet());
        if (!previousIds.equals(expandedIds)) {
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
                || request.getSeatIds().size() > properties.getMaxSeatsPerBooking()
                || request.getSeatIds().stream().anyMatch(id -> id == null || id <= 0)
                || request.getSeatIds().stream().distinct().count() != request.getSeatIds().size()) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_SELECTION_INVALID);
        }
        return request.getSeatIds().stream().sorted().toList();
    }

    private void validateExpandedSelection(List<Long> requestedIds, List<ShowtimeSeat> seats) {
        Set<Long> expandedIds = seats.stream()
                .map(ShowtimeSeat::getShowtimeSeatId)
                .collect(java.util.stream.Collectors.toSet());
        if (!expandedIds.containsAll(requestedIds)
                || seats.size() > properties.getMaxSeatsPerBooking()
                || expandedIds.size() != seats.size()) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_SELECTION_INVALID);
        }
    }

    private void validateIdentity(String ownerId, String idempotencyKey) {
        if (ownerId == null || ownerId.isBlank()) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_OWNER_REQUIRED);
        }
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 128) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_IDEMPOTENCY_KEY_REQUIRED);
        }
    }

    private void validateHoldMutationIdentity(String holdId, String ownerId) {
        if (holdId == null || holdId.isBlank() || holdId.length() > 36) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_NOT_FOUND);
        }
        if (ownerId == null || ownerId.isBlank()) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_OWNER_REQUIRED);
        }
    }

    private void validateHoldOwner(List<ShowtimeSeat> seats, String ownerId) {
        if (seats.stream().anyMatch(seat -> !ownerId.equals(seat.getReservedBy()))) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_OWNER_MISMATCH);
        }
    }

    private void clearExpiredHold(ShowtimeSeat seat) {
        clearHold(seat);
    }

    private void clearHold(ShowtimeSeat seat) {
        seat.setStatus(ShowtimeSeatStatus.AVAILABLE);
        seat.setReservedAt(null);
        seat.setReservedExpiresAt(null);
        seat.setBookingId(null);
        seat.setHoldId(null);
        seat.setReservedBy(null);
        seat.setHoldIdempotencyKey(null);
    }

    private ShowtimeSeatHoldMutationResponse toMutationResponse(
            Long showtimeId,
            String holdId,
            List<ShowtimeSeat> seats,
            String bookingId,
            boolean replayed) {
        return ShowtimeSeatHoldMutationResponse.builder()
                .holdId(holdId)
                .showtimeId(showtimeId)
                .seatIds(seats.stream().map(ShowtimeSeat::getShowtimeSeatId).toList())
                .status(ShowtimeSeatStatus.SOLD.name())
                .bookingId(bookingId)
                .replayed(replayed)
                .build();
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
            totalPrice = totalPrice.add(seat.getPrice() == null ? BigDecimal.ZERO : seat.getPrice());
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
