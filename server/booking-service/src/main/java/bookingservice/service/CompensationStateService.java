package bookingservice.service;

import bookingservice.entity.Booking;
import bookingservice.entity.CompensationTask;
import bookingservice.entity.InventoryStatus;
import bookingservice.repository.BookingRepository;
import bookingservice.repository.CompensationTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CompensationStateService {
    private static final List<String> RETRYABLE_STATUSES = List.of("PENDING", "FAILED");
    private static final int MAX_ATTEMPTS = 12;

    private final CompensationTaskRepository compensationTaskRepository;
    private final BookingRepository bookingRepository;
    private final BookingEventService bookingEventService;
    private final PaymentProcessingStateService paymentProcessingStateService;
    private final Clock bookingClock;

    @Transactional(readOnly = true)
    public List<String> dueTaskIds() {
        return compensationTaskRepository
                .findDue(
                        RETRYABLE_STATUSES,
                        OffsetDateTime.now(bookingClock))
                .stream()
                .map(CompensationTask::getTaskId)
                .toList();
    }

    @Transactional
    public CompensationInstruction claim(String taskId) {
        CompensationTask task = compensationTaskRepository.findByIdForUpdate(taskId).orElse(null);
        if (task == null || "COMPLETED".equals(task.getStatus())
                || "PROCESSING".equals(task.getStatus())) {
            return null;
        }
        OffsetDateTime now = OffsetDateTime.now(bookingClock);
        if (task.getNextAttemptAt() != null && task.getNextAttemptAt().isAfter(now)) {
            return null;
        }
        Booking booking = task.getBooking();
        if (booking == null) {
            task.setStatus("DEAD");
            task.setLastError("Compensation task has no booking reference.");
            return null;
        }
        task.setStatus("PROCESSING");
        task.setAttemptCount(task.getAttemptCount() + 1);
        task.setClaimedBy("booking-service");
        task.setClaimUntil(now.plusSeconds(30));
        task.setLastError(null);
        return new CompensationInstruction(
                task.getTaskId(),
                task.getTaskType(),
                booking.getBookingId(),
                booking.getShowtimeId(),
                booking.getHoldReference(),
                booking.getAccountId());
    }

    @Transactional
    public void complete(CompensationInstruction instruction) {
        CompensationTask task = compensationTaskRepository.findByIdForUpdate(instruction.taskId())
                .orElse(null);
        if (task == null || "COMPLETED".equals(task.getStatus())) {
            return;
        }
        Booking booking = bookingRepository.findByIdForUpdate(instruction.bookingId())
                .orElse(null);
        if (booking != null) {
            if (isConfirm(instruction.operation())) {
                paymentProcessingStateService.completeCompensatedInventoryConfirmation(
                        booking.getBookingId(),
                        task.getCorrelationId());
            } else {
                booking.setInventoryStatus(InventoryStatus.RELEASED);
                booking.getInventoryReservation().setStatus(InventoryStatus.RELEASED);
                booking.getInventoryReservation().setReleasedAt(OffsetDateTime.now(bookingClock));
            }
            bookingEventService.append(
                    booking,
                    "BOOKING_COMPENSATION_COMPLETED",
                    task.getCorrelationId());
        }
        task.setStatus("COMPLETED");
        task.setNextAttemptAt(null);
        task.setClaimUntil(null);
        task.setClaimedBy(null);
        task.setLastError(null);
    }

    @Transactional
    public void fail(CompensationInstruction instruction, RuntimeException exception) {
        compensationTaskRepository.findByIdForUpdate(instruction.taskId()).ifPresent(task -> {
            boolean exhausted = task.getAttemptCount() >= MAX_ATTEMPTS;
            task.setStatus(exhausted ? "DEAD" : "FAILED");
            task.setNextAttemptAt(exhausted
                    ? null
                    : OffsetDateTime.now(bookingClock).plusSeconds(backoffSeconds(task.getAttemptCount())));
            task.setClaimUntil(null);
            task.setClaimedBy(null);
            task.setLastError(safeMessage(exception));
        });
    }

    private boolean isConfirm(String operation) {
        return "CONFIRM_SEAT_HOLD".equals(operation);
    }

    private long backoffSeconds(int attempt) {
        return Math.min(900L, 10L * (1L << Math.min(attempt, 6)));
    }

    private String safeMessage(RuntimeException exception) {
        String message = exception.getMessage();
        String result = exception.getClass().getSimpleName()
                + (message == null ? "" : ": " + message);
        return result.length() > 2000 ? result.substring(0, 2000) : result;
    }

    public record CompensationInstruction(
            String taskId,
            String operation,
            String bookingId,
            Long showtimeId,
            String holdId,
            String ownerId) {
    }
}
