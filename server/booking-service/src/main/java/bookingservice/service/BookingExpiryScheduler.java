package bookingservice.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class BookingExpiryScheduler {
    private final BookingExpiryCoordinator coordinator;

    @Scheduled(fixedDelayString = "${booking.expiry.fixed-delay-ms:30000}")
    public void releaseExpiredBookings() {
        coordinator.expireDueBookings();
    }
}
