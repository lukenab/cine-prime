package bookingservice.service;

import java.time.LocalDateTime;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import bookingservice.entity.BookingStatus;
import bookingservice.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** Releases a pending promotion reservation when its booking's seat hold has expired. */
@Component
@RequiredArgsConstructor
@Slf4j
public class BookingExpiryScheduler {
    private final BookingRepository bookingRepository;
    private final BookingService bookingService;

    @Scheduled(fixedDelayString = "${booking.expiry-sweep-ms:60000}")
    public void expirePendingBookings() {
        for (var booking : bookingRepository.findByStatusAndExpiresAtBefore(
                BookingStatus.PENDING.name(), LocalDateTime.now())) {
            try {
                bookingService.expirePendingBooking(booking.getBookingId());
            } catch (RuntimeException ex) {
                // Keep PENDING when Promotion Service cannot release. The next sweep retries safely.
                log.warn("cannot expire booking {} yet", booking.getBookingId(), ex);
            }
        }
    }
}
