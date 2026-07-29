package bookingservice.service;

import bookingservice.dto.request.PaymentOutcomeRequest;
import bookingservice.dto.response.PaymentOutcomeResponse;
import bookingservice.entity.*;
import bookingservice.repository.*;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.Locale;

import static bookingservice.exception.BookingErrorCode.BOOKING_NOT_FOUND;

@Service
@RequiredArgsConstructor
public class PaymentProcessingStateService {
    private static final String PROCESSED = "PROCESSED";
    private static final String PROCESSING = "PROCESSING";
    private static final String REJECTED = "REJECTED";
    private static final String FAILED_RETRYABLE = "FAILED_RETRYABLE";

    private final PaymentEventInboxRepository inboxRepository;
    private final BookingRepository bookingRepository;
    private final BookingReconciliationRepository reconciliationRepository;
    private final CompensationTaskRepository compensationTaskRepository;
    private final TicketRepository ticketRepository;
    private final CounterPaymentRepository counterPaymentRepository;
    private final BookingEventService bookingEventService;
    private final TicketPassService ticketPassService;

    @Transactional
    public PaymentInstruction prepare(
            PaymentOutcomeRequest request,
            String rawPayload,
            String correlationId) {
        PaymentEventInbox duplicate = inboxRepository
                .findByEventSourceAndEventId(request.getSource(), request.getEventId())
                .orElse(null);
        if (duplicate != null) {
            return instructionForDuplicate(duplicate);
        }

        Booking booking = bookingRepository.findByIdForUpdate(request.getBookingId())
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
        PaymentEventInbox inbox = inboxRepository.save(PaymentEventInbox.builder()
                .eventSource(request.getSource())
                .eventId(request.getEventId())
                .eventType(request.getEventType())
                .eventVersion("1")
                .booking(booking)
                .paymentReference(request.getPaymentReference())
                .amount(request.getAmount())
                .currency(request.getCurrency().toUpperCase(Locale.ROOT))
                .correlationId(correlationId)
                .payload(rawPayload)
                .status("RECEIVED")
                .attemptCount(1)
                .build());

        if (!sameMoney(booking, request)) {
            inbox.setStatus(REJECTED);
            inbox.setProcessedAt(OffsetDateTime.now());
            inbox.setLastError("Payment amount or currency does not match the booking snapshot.");
            return instruction(Action.REJECT_AMOUNT, booking, inbox, false, true);
        }

        if (isSuccess(request.getEventType())) {
            return prepareSuccess(booking, inbox, request, correlationId);
        }
        if (isFailure(request.getEventType())) {
            return prepareFailure(booking, inbox, correlationId);
        }

        inbox.setStatus(REJECTED);
        inbox.setProcessedAt(OffsetDateTime.now());
        inbox.setLastError("Unsupported payment event type: " + request.getEventType());
        return instruction(Action.REJECT_EVENT, booking, inbox, false, false);
    }

    private PaymentInstruction prepareSuccess(
            Booking booking,
            PaymentEventInbox inbox,
            PaymentOutcomeRequest request,
            String correlationId) {
        if (booking.getStatus() == BookingStatus.CONFIRMED
                && booking.getPaymentStatus() == PaymentStatus.SUCCEEDED) {
            inbox.setStatus(PROCESSED);
            inbox.setProcessedAt(OffsetDateTime.now());
            return instruction(Action.NONE, booking, inbox, true, false);
        }

        boolean expired = booking.getStatus() == BookingStatus.EXPIRED
                || booking.getExpiresAt().isBefore(OffsetDateTime.now());
        booking.setPaymentReference(request.getPaymentReference());
        booking.setPaidAt(request.getOccurredAt() == null
                ? OffsetDateTime.now()
                : request.getOccurredAt());
        booking.setPaymentStatus(PaymentStatus.SUCCEEDED);

        if (expired) {
            booking.setStatus(BookingStatus.EXPIRED);
            createReconciliation(
                    booking,
                    "LATE_PAYMENT_AFTER_EXPIRY",
                    "CRITICAL",
                    "Verified payment arrived after the booking hold had expired.",
                    inbox.getCorrelationId(),
                    "late-payment:" + inbox.getEventSource() + ":" + inbox.getEventId());
            inbox.setStatus(PROCESSED);
            inbox.setProcessedAt(OffsetDateTime.now());
            bookingEventService.append(booking, "BOOKING_LATE_PAYMENT_REQUIRES_RECONCILIATION", correlationId);
            return instruction(Action.LATE_PAYMENT, booking, inbox, false, true);
        }

        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT
                && booking.getStatus() != BookingStatus.CONFIRM_PENDING) {
            createReconciliation(
                    booking,
                    "PAYMENT_STATE_CONFLICT",
                    "HIGH",
                    "Verified payment is incompatible with booking status " + booking.getStatus() + ".",
                    inbox.getCorrelationId(),
                    "payment-state:" + inbox.getEventSource() + ":" + inbox.getEventId());
            inbox.setStatus(PROCESSED);
            inbox.setProcessedAt(OffsetDateTime.now());
            return instruction(Action.NONE, booking, inbox, false, true);
        }

        booking.setStatus(BookingStatus.CONFIRM_PENDING);
        booking.setInventoryStatus(InventoryStatus.CONFIRM_PENDING);
        booking.getInventoryReservation().setStatus(InventoryStatus.CONFIRM_PENDING);
        inbox.setStatus(PROCESSING);
        return instruction(Action.CONFIRM_INVENTORY, booking, inbox, false, false);
    }

    private PaymentInstruction prepareFailure(
            Booking booking,
            PaymentEventInbox inbox,
            String correlationId) {
        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            createReconciliation(
                    booking,
                    "PAYMENT_FAILURE_AFTER_CONFIRMATION",
                    "CRITICAL",
                    "A failed payment event arrived after inventory had been sold.",
                    inbox.getCorrelationId(),
                    "failed-after-confirm:" + inbox.getEventSource() + ":" + inbox.getEventId());
            inbox.setStatus(PROCESSED);
            inbox.setProcessedAt(OffsetDateTime.now());
            return instruction(Action.NONE, booking, inbox, false, true);
        }
        booking.setPaymentStatus(PaymentStatus.FAILED);
        booking.setStatus(BookingStatus.CANCELLED);
        if (booking.getInventoryStatus() == InventoryStatus.HELD
                || booking.getInventoryStatus() == InventoryStatus.CONFIRM_PENDING) {
            booking.setInventoryStatus(InventoryStatus.RELEASE_PENDING);
            booking.getInventoryReservation().setStatus(InventoryStatus.RELEASE_PENDING);
            inbox.setStatus(PROCESSING);
            bookingEventService.append(booking, "BOOKING_PAYMENT_FAILED_RELEASE_PENDING", correlationId);
            return instruction(Action.RELEASE_INVENTORY, booking, inbox, false, false);
        }
        inbox.setStatus(PROCESSED);
        inbox.setProcessedAt(OffsetDateTime.now());
        return instruction(Action.NONE, booking, inbox, false, false);
    }

    @Transactional
    public PaymentOutcomeResponse completeInventoryConfirmation(PaymentInstruction instruction) {
        Booking booking = lockedBooking(instruction.bookingId());
        PaymentEventInbox inbox = inboxRepository.findById(instruction.inboxId()).orElseThrow();
        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setPaymentStatus(PaymentStatus.SUCCEEDED);
            booking.setInventoryStatus(InventoryStatus.SOLD);
            booking.getInventoryReservation().setStatus(InventoryStatus.SOLD);
            booking.getInventoryReservation().setConfirmedAt(OffsetDateTime.now());
            issueTickets(booking);
            ticketPassService.issue(booking);
            bookingEventService.append(booking, "BOOKING_CONFIRMED", inbox.getCorrelationId());
        }
        inbox.setStatus(PROCESSED);
        inbox.setProcessedAt(OffsetDateTime.now());
        return response(booking, inbox, instruction.replayed(), false);
    }

    @Transactional
    public bookingservice.dto.response.CounterSaleResponse completeCounterSale(
            String bookingId,
            String cashierId,
            String terminalId,
            String paymentMethod,
            String receiptReference,
            String correlationId) {
        Booking booking = lockedBooking(bookingId);
        CounterPayment existing = counterPaymentRepository
                .findByBooking_BookingId(bookingId)
                .orElse(null);
        if (existing != null) {
            return counterSaleResponse(booking, existing, true);
        }
        if (booking.getBookingType() != BookingType.COUNTER
                || (booking.getStatus() != BookingStatus.PENDING_PAYMENT
                && booking.getStatus() != BookingStatus.CONFIRM_PENDING)) {
            throw new AppException(bookingservice.exception.BookingErrorCode.COUNTER_PAYMENT_INVALID);
        }

        String normalizedMethod = normalizeCounterPaymentMethod(paymentMethod);
        String paymentReference = "COUNTER-" + booking.getBookingCode();
        OffsetDateTime paidAt = OffsetDateTime.now();
        CounterPayment counterPayment = counterPaymentRepository.save(CounterPayment.builder()
                .booking(booking)
                .paymentReference(paymentReference)
                .receiptReference(receiptReference.trim())
                .cashierId(cashierId)
                .terminalId(terminalId.trim())
                .clusterId(booking.getClusterId())
                .paymentMethod(normalizedMethod)
                .amount(booking.getFinalAmount())
                .currency(booking.getCurrency())
                .collectedAt(paidAt)
                .build());

        booking.setPaymentReference(paymentReference);
        booking.setPaidAt(paidAt);
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentStatus(PaymentStatus.SUCCEEDED);
        booking.setInventoryStatus(InventoryStatus.SOLD);
        booking.getInventoryReservation().setStatus(InventoryStatus.SOLD);
        booking.getInventoryReservation().setConfirmedAt(paidAt);
        issueTickets(booking);
        ticketPassService.issue(booking);
        bookingEventService.append(booking, "COUNTER_SALE_CONFIRMED", correlationId);
        return counterSaleResponse(booking, counterPayment, false);
    }

    @Transactional(readOnly = true)
    public bookingservice.dto.response.CounterSaleResponse currentCounterSale(String bookingId) {
        CounterPayment payment = counterPaymentRepository.findByBooking_BookingId(bookingId)
                .orElseThrow(() -> new AppException(
                        bookingservice.exception.BookingErrorCode.COUNTER_PAYMENT_INVALID));
        return counterSaleResponse(payment.getBooking(), payment, true);
    }

    @Transactional
    public void markCounterSaleCreationFailure(
            String bookingId,
            String correlationId,
            RuntimeException exception) {
        Booking booking = lockedBooking(bookingId);
        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            return;
        }
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setPaymentStatus(PaymentStatus.FAILED);
        booking.setInventoryStatus(InventoryStatus.RELEASED);
        booking.getInventoryReservation().setStatus(InventoryStatus.RELEASED);
        booking.getInventoryReservation().setReleasedAt(OffsetDateTime.now());
        bookingEventService.append(
                booking,
                "COUNTER_SALE_CREATION_FAILED",
                correlationId);
    }

    @Transactional
    public void markCounterSaleFinalizationFailure(
            String bookingId,
            String correlationId,
            RuntimeException exception) {
        Booking booking = lockedBooking(bookingId);
        booking.setStatus(BookingStatus.CONFIRM_PENDING);
        booking.setInventoryStatus(InventoryStatus.CONFIRM_PENDING);
        booking.getInventoryReservation().setStatus(InventoryStatus.CONFIRM_PENDING);
        createReconciliation(
                booking,
                "COUNTER_INVENTORY_SOLD_BUT_BOOKING_FINALIZATION_FAILED",
                "CRITICAL",
                "Movie inventory was sold but counter booking finalization failed: "
                        + exception.getClass().getSimpleName(),
                correlationId,
                "counter-finalization:" + bookingId);
        bookingEventService.append(
                booking,
                "COUNTER_SALE_REQUIRES_RECONCILIATION",
                correlationId);
    }

    @Transactional
    public void completeCompensatedInventoryConfirmation(
            String bookingId,
            String correlationId) {
        Booking booking = lockedBooking(bookingId);
        if (booking.getStatus() == BookingStatus.CONFIRMED
                && booking.getInventoryStatus() == InventoryStatus.SOLD) {
            return;
        }
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentStatus(PaymentStatus.SUCCEEDED);
        booking.setInventoryStatus(InventoryStatus.SOLD);
        booking.getInventoryReservation().setStatus(InventoryStatus.SOLD);
        booking.getInventoryReservation().setConfirmedAt(OffsetDateTime.now());
        issueTickets(booking);
        ticketPassService.issue(booking);
        bookingEventService.append(
                booking,
                "BOOKING_CONFIRMED_AFTER_COMPENSATION",
                correlationId);
    }

    @Transactional
    public PaymentOutcomeResponse completeInventoryRelease(PaymentInstruction instruction) {
        Booking booking = lockedBooking(instruction.bookingId());
        PaymentEventInbox inbox = inboxRepository.findById(instruction.inboxId()).orElseThrow();
        booking.setInventoryStatus(InventoryStatus.RELEASED);
        booking.getInventoryReservation().setStatus(InventoryStatus.RELEASED);
        booking.getInventoryReservation().setReleasedAt(OffsetDateTime.now());
        inbox.setStatus(PROCESSED);
        inbox.setProcessedAt(OffsetDateTime.now());
        bookingEventService.append(booking, "BOOKING_INVENTORY_RELEASED", inbox.getCorrelationId());
        return response(booking, inbox, instruction.replayed(), false);
    }

    @Transactional
    public PaymentOutcomeResponse markDependencyFailure(
            PaymentInstruction instruction,
            RuntimeException exception) {
        Booking booking = lockedBooking(instruction.bookingId());
        PaymentEventInbox inbox = inboxRepository.findById(instruction.inboxId()).orElseThrow();
        inbox.setStatus(FAILED_RETRYABLE);
        inbox.setLastError(exception.getClass().getSimpleName() + ": " + exception.getMessage());
        inbox.setNextAttemptAt(OffsetDateTime.now().plusMinutes(1));

        String operation = instruction.action() == Action.CONFIRM_INVENTORY
                ? "CONFIRM_SEAT_HOLD"
                : "RELEASE_SEAT_HOLD";
        createCompensation(booking, operation, inbox.getCorrelationId(), inbox.getEventId());
        if (instruction.action() == Action.CONFIRM_INVENTORY) {
            createReconciliation(
                    booking,
                    "PAID_BUT_INVENTORY_CONFIRMATION_FAILED",
                    "CRITICAL",
                    "Payment is verified but movie-service did not confirm the seat hold.",
                    inbox.getCorrelationId(),
                    "confirm-failure:" + inbox.getEventSource() + ":" + inbox.getEventId());
        }
        return response(
                booking,
                inbox,
                instruction.replayed(),
                instruction.action() == Action.CONFIRM_INVENTORY);
    }

    @Transactional(readOnly = true)
    public PaymentOutcomeResponse currentResponse(PaymentInstruction instruction) {
        PaymentEventInbox inbox = inboxRepository.findById(instruction.inboxId()).orElseThrow();
        Booking booking = inbox.getBooking();
        return response(booking, inbox, instruction.replayed(), instruction.reconciliationRequired());
    }

    private void issueTickets(Booking booking) {
        for (BookingItem item : booking.getBookingDetails()) {
            if (ticketRepository.existsByBookingDetail_DetailId(item.getDetailId())) {
                continue;
            }
            Ticket ticket = Ticket.builder()
                    .booking(booking)
                    .bookingDetail(item)
                    .accountId(booking.getAccountId())
                    .showtimeId(booking.getShowtimeId())
                    .movieName(booking.getMovieName())
                    .clusterId(booking.getClusterId())
                    .clusterName(booking.getClusterName())
                    .cinemaRoomName(booking.getCinemaRoomName())
                    .seatCode(item.getSeatCode())
                    .seatType(item.getSeatType())
                    .price(item.getFinalPrice())
                    .status(TicketStatus.VALID)
                    .issuedBy("SYSTEM:PAYMENT")
                    .build();
            ticketRepository.save(ticket);
            booking.getTickets().add(ticket);
        }
    }

    private PaymentInstruction instructionForDuplicate(PaymentEventInbox inbox) {
        Booking booking = inbox.getBooking();
        Action action = Action.NONE;
        if (FAILED_RETRYABLE.equals(inbox.getStatus())) {
            if (booking.getInventoryStatus() == InventoryStatus.CONFIRM_PENDING) {
                action = Action.CONFIRM_INVENTORY;
            } else if (booking.getInventoryStatus() == InventoryStatus.RELEASE_PENDING) {
                action = Action.RELEASE_INVENTORY;
            }
        }
        return instruction(action, booking, inbox, true, false);
    }

    private Booking lockedBooking(String bookingId) {
        return bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
    }

    private boolean sameMoney(Booking booking, PaymentOutcomeRequest request) {
        BigDecimal expected = booking.getFinalAmount().setScale(2, RoundingMode.HALF_UP);
        BigDecimal actual = request.getAmount().setScale(2, RoundingMode.HALF_UP);
        return expected.compareTo(actual) == 0
                && booking.getCurrency().equalsIgnoreCase(request.getCurrency());
    }

    private boolean isSuccess(String eventType) {
        String normalized = eventType.toUpperCase(Locale.ROOT);
        return normalized.equals("PAYMENT_SUCCEEDED")
                || normalized.equals("PAYMENT.SUCCEEDED")
                || normalized.equals("SUCCEEDED")
                || normalized.equals("PAID");
    }

    private boolean isFailure(String eventType) {
        String normalized = eventType.toUpperCase(Locale.ROOT);
        return normalized.equals("PAYMENT_FAILED")
                || normalized.equals("PAYMENT.FAILED")
                || normalized.equals("FAILED")
                || normalized.equals("CANCELLED");
    }

    private String normalizeCounterPaymentMethod(String paymentMethod) {
        if (paymentMethod == null) {
            throw new AppException(bookingservice.exception.BookingErrorCode.COUNTER_PAYMENT_INVALID);
        }
        String normalized = paymentMethod.trim().toUpperCase(Locale.ROOT);
        if (!java.util.Set.of("CASH", "CARD", "QR", "BANK_TRANSFER").contains(normalized)) {
            throw new AppException(bookingservice.exception.BookingErrorCode.COUNTER_PAYMENT_INVALID);
        }
        return normalized;
    }

    private bookingservice.dto.response.CounterSaleResponse counterSaleResponse(
            Booking booking,
            CounterPayment payment,
            boolean replayed) {
        return bookingservice.dto.response.CounterSaleResponse.builder()
                .bookingId(booking.getBookingId())
                .bookingCode(booking.getBookingCode())
                .status(booking.getStatus().name())
                .paymentStatus(booking.getPaymentStatus().name())
                .paymentReference(payment.getPaymentReference())
                .receiptReference(payment.getReceiptReference())
                .paymentMethod(payment.getPaymentMethod())
                .total(booking.getFinalAmount())
                .currency(booking.getCurrency())
                .seatCodes(booking.getBookingDetails().stream()
                        .map(BookingItem::getSeatCode)
                        .sorted()
                        .toList())
                .paidAt(booking.getPaidAt())
                .replayed(replayed)
                .build();
    }

    private void createReconciliation(
            Booking booking,
            String caseType,
            String severity,
            String evidence,
            String correlationId,
            String idempotencyKey) {
        if (reconciliationRepository.existsByIdempotencyKey(idempotencyKey)) {
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
                .createdBy("SYSTEM:PAYMENT_WEBHOOK")
                .correlationId(correlationId)
                .idempotencyKey(idempotencyKey)
                .build());
    }

    private void createCompensation(
            Booking booking,
            String operation,
            String correlationId,
            String eventId) {
        String key = "payment-compensation:" + eventId + ":" + operation;
        if (compensationTaskRepository.existsByIdempotencyKey(key)) {
            return;
        }
        compensationTaskRepository.save(CompensationTask.builder()
                .booking(booking)
                .taskType(operation)
                .targetService("movie-service")
                .targetReference(booking.getHoldReference())
                .idempotencyKey(key)
                .status("PENDING")
                .commandPayload("{\"showtimeId\":" + booking.getShowtimeId()
                        + ",\"holdId\":\"" + booking.getHoldReference() + "\"}")
                .correlationId(correlationId)
                .nextAttemptAt(OffsetDateTime.now().plusMinutes(1))
                .build());
    }

    private PaymentInstruction instruction(
            Action action,
            Booking booking,
            PaymentEventInbox inbox,
            boolean replayed,
            boolean reconciliationRequired) {
        return new PaymentInstruction(
                action,
                booking.getBookingId(),
                booking.getShowtimeId(),
                booking.getHoldReference(),
                booking.getAccountId(),
                inbox.getInboxId(),
                replayed,
                reconciliationRequired);
    }

    private PaymentOutcomeResponse response(
            Booking booking,
            PaymentEventInbox inbox,
            boolean replayed,
            boolean reconciliationRequired) {
        return PaymentOutcomeResponse.builder()
                .eventId(inbox.getEventId())
                .bookingId(booking.getBookingId())
                .bookingStatus(booking.getStatus().name())
                .paymentStatus(booking.getPaymentStatus().name())
                .replayed(replayed)
                .reconciliationRequired(reconciliationRequired)
                .build();
    }

    public enum Action {
        NONE,
        CONFIRM_INVENTORY,
        RELEASE_INVENTORY,
        LATE_PAYMENT,
        REJECT_AMOUNT,
        REJECT_EVENT
    }

    public record PaymentInstruction(
            Action action,
            String bookingId,
            Long showtimeId,
            String holdId,
            String ownerId,
            String inboxId,
            boolean replayed,
            boolean reconciliationRequired) {
    }
}
