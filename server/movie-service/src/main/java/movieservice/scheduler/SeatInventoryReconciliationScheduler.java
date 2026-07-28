package movieservice.scheduler;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movieservice.service.SeatInventoryReconciliationService;
import movieservice.service.SeatInventoryReconciliationService.ReconciliationResult;

@Component
@RequiredArgsConstructor
@Slf4j
public class SeatInventoryReconciliationScheduler {

    private final SeatInventoryReconciliationService reconciliationService;

    @Scheduled(fixedDelayString = "${showtime.seat-hold.reconciliation-delay-ms:60000}")
    public void reconcile() {
        ReconciliationResult result = reconciliationService.reconcile();
        if (result.repairedReservations() > 0
                || result.manualReview() > 0
                || result.correctedCounters() > 0) {
            log.warn(
                    "Seat reconciliation completed: repairedReservations={}, manualReview={}, correctedCounters={}",
                    result.repairedReservations(),
                    result.manualReview(),
                    result.correctedCounters());
        }
    }
}
