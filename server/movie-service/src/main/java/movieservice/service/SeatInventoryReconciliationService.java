package movieservice.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.SeatInventoryEventType;
import movieservice.enums.ShowtimeSeatStatus;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeSeatRepository;

/**
 * Repairs safe inventory drift and reports cases that require an operator.
 *
 * <p>Incomplete RESERVED rows are safe to release because they cannot prove
 * ownership or expiry. SOLD rows without a booking id are only reported: an
 * automated release could resell a paid seat.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SeatInventoryReconciliationService {

    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final ShowTimeRepository showTimeRepository;
    private final SeatInventoryOutboxService outboxService;
    private final SeatHoldRateLimitService rateLimitService;
    private final SeatHoldMetrics metrics;

    @Transactional
    public ReconciliationResult reconcile() {
        List<ShowtimeSeat> anomalies = showtimeSeatRepository.findInventoryAnomalies();
        int repairedReservations = 0;
        int manualReview = 0;

        for (ShowtimeSeat seat : anomalies) {
            metrics.reconciliationMismatch();
            if (seat.getStatus() == ShowtimeSeatStatus.RESERVED) {
                Long showtimeId = seat.getShowTime().getShowTimeId();
                String holdId = seat.getHoldId();
                seat.setStatus(ShowtimeSeatStatus.AVAILABLE);
                seat.setReservedAt(null);
                seat.setReservedExpiresAt(null);
                seat.setHoldId(null);
                seat.setReservedBy(null);
                seat.setHoldIdempotencyKey(null);
                outboxService.record(
                        SeatInventoryEventType.RELEASED,
                        showtimeId,
                        holdId,
                        List.of(seat.getShowtimeSeatId()),
                        null,
                        null);
                repairedReservations++;
            } else {
                manualReview++;
                log.error(
                        "Seat inventory requires manual review: showtimeSeatId={} status={} missing bookingId",
                        seat.getShowtimeSeatId(),
                        seat.getStatus());
            }
        }
        showtimeSeatRepository.saveAll(anomalies);

        int correctedCounters = reconcileSoldCounters();
        int deletedRateWindows = rateLimitService.deleteOldWindows();
        return new ReconciliationResult(
                repairedReservations,
                manualReview,
                correctedCounters,
                deletedRateWindows);
    }

    private int reconcileSoldCounters() {
        int corrected = 0;
        List<ShowTime> changed = new ArrayList<>();
        for (ShowTime showtime : showTimeRepository.findAll()) {
            long actual = showtimeSeatRepository.countByShowTime_ShowTimeIdAndStatus(
                    showtime.getShowTimeId(),
                    ShowtimeSeatStatus.SOLD);
            int stored = showtime.getSoldSeats() == null ? 0 : showtime.getSoldSeats();
            if (stored != actual) {
                metrics.reconciliationMismatch();
                showtime.setSoldSeats(Math.toIntExact(actual));
                changed.add(showtime);
                corrected++;
                log.warn(
                        "Corrected sold seat counter for showtime {} from {} to {}",
                        showtime.getShowTimeId(),
                        stored,
                        actual);
            }
        }
        if (!changed.isEmpty()) {
            showTimeRepository.saveAll(changed);
        }
        return corrected;
    }

    public record ReconciliationResult(
            int repairedReservations,
            int manualReview,
            int correctedCounters,
            int deletedRateWindows) {
    }
}
