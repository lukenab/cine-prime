package movieservice.scheduler;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movieservice.service.SeatInventoryOutboxService;

@Component
@RequiredArgsConstructor
@Slf4j
public class SeatInventoryOutboxScheduler {

    private final SeatInventoryOutboxService outboxService;

    @Scheduled(fixedDelayString = "${showtime.seat-hold.outbox-delay-ms:1000}")
    public void publishPendingEvents() {
        int published = outboxService.publishPending();
        if (published > 0) {
            log.debug("Published {} seat inventory event(s)", published);
        }
    }
}
