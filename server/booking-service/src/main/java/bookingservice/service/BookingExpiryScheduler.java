package bookingservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled job that expires bookings. Delegates to BookingExpiryCoordinator
 * which handles promotion reservation release for promotion-enabled bookings.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BookingExpiryScheduler {
    private final BookingExpiryCoordinator coordinator;

    @Scheduled(fixedDelayString = "${booking.expiry.fixed-delay-ms:30000}")
    public void releaseExpiredBookings() {
        log.debug("Starting booking expiry sweep");
        coordinator.expireDueBookings();
    }
}
