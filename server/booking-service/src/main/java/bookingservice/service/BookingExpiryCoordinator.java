package bookingservice.service;

import bookingservice.client.MovieInventoryClient;
import bookingservice.entity.BookingStatus;
import bookingservice.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
public class BookingExpiryCoordinator {
    private final BookingRepository bookingRepository;
    private final BookingExpiryStateService stateService;
    private final MovieInventoryClient movieInventoryClient;
    private final Clock bookingClock;

    @Value("${movie-service.internal-key}")
    private String movieServiceInternalKey;

    public void expireDueBookings() {
        bookingRepository.findTop100ByStatusAndExpiresAtBeforeOrderByExpiresAtAsc(
                        BookingStatus.PENDING_PAYMENT,
                        OffsetDateTime.now(bookingClock))
                .forEach(booking -> expireOne(booking.getBookingId()));
    }

    void expireOne(String bookingId) {
        BookingExpiryStateService.ExpiryInstruction instruction =
                stateService.prepare(bookingId);
        if (instruction.action()
                != BookingExpiryStateService.ExpiryAction.RELEASE_INVENTORY) {
            return;
        }
        try {
            movieInventoryClient.releaseHold(
                    instruction.showtimeId(),
                    instruction.holdId(),
                    movieServiceInternalKey,
                    instruction.ownerId());
            stateService.completeRelease(instruction);
        } catch (RuntimeException exception) {
            stateService.markReleaseFailure(instruction, exception);
        }
    }
}
