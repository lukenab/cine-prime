package bookingservice.service;

import bookingservice.entity.*;
import bookingservice.repository.BookingReconciliationRepository;
import bookingservice.repository.BookingRepository;
import bookingservice.repository.CompensationTaskRepository;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;

import static bookingservice.exception.BookingErrorCode.BOOKING_NOT_FOUND;

@Service
@RequiredArgsConstructor
public class BookingExpiryStateService {
    private final BookingRepository bookingRepository;
    private final BookingReconciliationRepository reconciliationRepository;
    private final CompensationTaskRepository compensationTaskRepository;
    private final BookingEventService bookingEventService;
    private final Clock bookingClock;

    @Transactional
    public ExpiryInstruction prepare(String bookingId) {
        Booking booking = lockedBooking(bookingId);
        OffsetDateTime now = OffsetDateTime.now(bookingClock);

        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT
                || booking.getExpiresAt().isAfter(now)) {
            return instruction(ExpiryAction.NONE, booking);
        }

        if (booking.getPaymentStatus() == PaymentStatus.SUCCEEDED) {
            createReconciliation(
                    booking,
                    "PAID_BOOKING_REACHED_EXPIRY_JOB",
                    "CRITICAL",
                    "The expiry worker found a verified payment before releasing inventory.");
            return instruction(ExpiryAction.MANUAL_RECONCILIATION, booking);
        }

        booking.setStatus(BookingStatus.EXPIRED);
        booking.setPaymentStatus(PaymentStatus.CANCELLED);
        if (booking.getInventoryStatus() == InventoryStatus.HELD
                || booking.getInventoryStatus() == InventoryStatus.CONFIRM_PENDING) {
            booking.setInventoryStatus(InventoryStatus.RELEASE_PENDING);
            booking.getInventoryReservation().setStatus(InventoryStatus.RELEASE_PENDING);
            bookingEventService.append(
                    booking,
                    "BOOKING_EXPIRED_RELEASE_PENDING",
                    correlationId(booking));
            return instruction(ExpiryAction.RELEASE_INVENTORY, booking);
        }

        bookingEventService.append(booking, "BOOKING_EXPIRED", correlationId(booking));
        return instruction(ExpiryAction.NONE, booking);
    }

    @Transactional
    public void completeRelease(ExpiryInstruction instruction) {
        Booking booking = lockedBooking(instruction.bookingId());
        if (booking.getInventoryStatus() == InventoryStatus.RELEASED) {
            return;
        }
        booking.setInventoryStatus(InventoryStatus.RELEASED);
        booking.getInventoryReservation().setStatus(InventoryStatus.RELEASED);
        booking.getInventoryReservation().setReleasedAt(OffsetDateTime.now(bookingClock));
        bookingEventService.append(
                booking,
                "BOOKING_EXPIRED_INVENTORY_RELEASED",
                correlationId(booking));
    }

    @Transactional
    public void markReleaseFailure(ExpiryInstruction instruction, RuntimeException exception) {
        Booking booking = lockedBooking(instruction.bookingId());
        String idempotencyKey = "expiry-release:" + booking.getBookingId();
        if (!compensationTaskRepository.existsByIdempotencyKey(idempotencyKey)) {
            compensationTaskRepository.save(CompensationTask.builder()
                    .booking(booking)
                    .taskType("RELEASE_EXPIRED_SEAT_HOLD")
                    .targetService("movie-service")
                    .targetReference(booking.getHoldReference())
                    .idempotencyKey(idempotencyKey)
                    .status("PENDING")
                    .commandPayload("{\"showtimeId\":" + booking.getShowtimeId()
                            + ",\"holdId\":\"" + booking.getHoldReference() + "\"}")
                    .correlationId(correlationId(booking))
                    .nextAttemptAt(OffsetDateTime.now(bookingClock).plusMinutes(1))
                    .lastError(safeMessage(exception))
                    .build());
        }
    }

    private Booking lockedBooking(String bookingId) {
        return bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
    }

    private void createReconciliation(
            Booking booking,
            String caseType,
            String severity,
            String evidence) {
        String key = "expiry-paid:" + booking.getBookingId();
        if (reconciliationRepository.existsByIdempotencyKey(key)) {
            return;
        }
        reconciliationRepository.save(BookingReconciliation.builder()
                .booking(booking)
                .caseType(caseType)
                .severity(severity)
                .status(ReconciliationStatus.MANUAL_REVIEW)
                .paymentReference(booking.getPaymentReference())
                .holdReference(booking.getHoldReference())
                .clusterId(booking.getClusterId())
                .evidence(evidence)
                .createdBy("SYSTEM:BOOKING_EXPIRY")
                .correlationId(correlationId(booking))
                .idempotencyKey(key)
                .build());
    }

    private ExpiryInstruction instruction(ExpiryAction action, Booking booking) {
        return new ExpiryInstruction(
                action,
                booking.getBookingId(),
                booking.getShowtimeId(),
                booking.getHoldReference(),
                booking.getAccountId(),
                booking.getConcessionItems().stream()
                        .map(ConcessionItem::getExternalReservationId)
                        .filter(java.util.Objects::nonNull)
                        .findFirst()
                        .orElse(null));
    }

    private String correlationId(Booking booking) {
        return "expiry:" + booking.getBookingId();
    }

    private String safeMessage(RuntimeException exception) {
        String message = exception.getMessage();
        return exception.getClass().getSimpleName()
                + (message == null ? "" : ": " + message);
    }

    public enum ExpiryAction {
        NONE,
        RELEASE_INVENTORY,
        MANUAL_RECONCILIATION
    }

    public record ExpiryInstruction(
            ExpiryAction action,
            String bookingId,
            Long showtimeId,
            String holdId,
            String ownerId,
            String concessionReservationId) {
    }
}
