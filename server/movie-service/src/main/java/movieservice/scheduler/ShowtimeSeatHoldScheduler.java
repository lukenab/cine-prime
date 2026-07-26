package movieservice.scheduler;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movieservice.service.ShowtimeSeatHoldService;

@Component
@RequiredArgsConstructor
@Slf4j
public class ShowtimeSeatHoldScheduler {

    private final ShowtimeSeatHoldService showtimeSeatHoldService;

    @Scheduled(fixedDelayString = "${showtime.seat-hold.cleanup-delay-ms:30000}")
    public void releaseExpiredHolds() {
        int released = showtimeSeatHoldService.releaseExpiredHolds();
        if (released > 0) {
            log.info("Released {} expired showtime seat hold(s)", released);
        }
    }
}
