package bookingservice.service;

import bookingservice.dto.request.CancelBookingRequest;
import bookingservice.dto.response.CancellationResponse;
import bookingservice.entity.*;
import bookingservice.repository.*;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.*;
import java.util.HexFormat;
import java.util.UUID;

import static bookingservice.exception.BookingErrorCode.*;

@Service
@RequiredArgsConstructor
public class BookingCancellationStateService {
    private final BookingRepository bookingRepository;
    private final BookingCancellationRepository cancellationRepository;
    private final RefundRepository refundRepository;
    private final TicketRepository ticketRepository;
    private final BookingTicketPassRepository ticketPassRepository;
    private final BookingReconciliationRepository reconciliationRepository;
    private final BookingEventService eventService;
    private final Clock bookingClock;

    @Value("${booking.cancel.mins-before-showtime:60}")
    private long cancellationCutoffMinutes;

    @Transactional
    public CancellationInstruction prepare(
            String bookingId,
            String accountId,
            String idempotencyKey,
            CancelBookingRequest request) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new AppException(INVALID_REQUEST);
        }
        String requestHash = hash(bookingId + "|" + request.getReasonCode()
                + "|" + String.valueOf(request.getReason()));
        BookingCancellation replay = cancellationRepository
                .findByIdempotencyKey(idempotencyKey)
                .orElse(null);
        if (replay != null) {
            if (!replay.getRequestHash().equals(requestHash)
                    || !replay.getBooking().getBookingId().equals(bookingId)) {
                throw new AppException(IDEMPOTENCY_CONFLICT);
            }
            return instruction(replay, replayAction(replay), true);
        }

        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
        if (!booking.getAccountId().equals(accountId)) {
            throw new AppException(BOOKING_FORBIDDEN);
        }
        validateEligibility(booking);

        String correlationId = UUID.randomUUID().toString();
        BookingCancellation cancellation = BookingCancellation.builder()
                .booking(booking)
                .idempotencyKey(idempotencyKey)
                .requestHash(requestHash)
                .source("CUSTOMER")
                .reasonCode(request.getReasonCode())
                .reason(request.getReason())
                .requestedBy(accountId)
                .correlationId(correlationId)
                .status(CancellationStatus.PROCESSING)
                .beforeSnapshot(booking.getStatus().name())
                .build();

        Action action;
        if (booking.getStatus() == BookingStatus.PENDING_PAYMENT
                || booking.getStatus() == BookingStatus.CONFIRM_PENDING) {
            booking.setStatus(BookingStatus.CANCEL_REQUESTED);
            booking.setInventoryStatus(InventoryStatus.RELEASE_PENDING);
            booking.getInventoryReservation().setStatus(InventoryStatus.RELEASE_PENDING);
            action = Action.RELEASE_HOLD;
            eventService.append(booking, "BOOKING_CANCELLATION_RELEASE_PENDING", correlationId);
        } else {
            Refund refund = Refund.builder()
                    .booking(booking)
                    .paymentReference(booking.getPaymentReference())
                    .idempotencyKey("refund:" + idempotencyKey)
                    .amount(booking.getFinalAmount())
                    .cashAmount(booking.getFinalAmount())
                    .currency(booking.getCurrency())
                    .reasonCode(request.getReasonCode())
                    .reason(request.getReason())
                    .status(RefundStatus.PENDING)
                    .build();
            refundRepository.save(refund);
            cancellation.setRefund(refund);
            booking.setStatus(BookingStatus.REFUND_PENDING);
            booking.setRefundStatus(RefundStatus.PENDING);
            action = Action.REQUEST_REFUND;
            eventService.append(booking, "BOOKING_REFUND_REQUESTED", correlationId);
        }
        cancellationRepository.save(cancellation);
        booking.getCancellations().add(cancellation);
        return instruction(cancellation, action, false);
    }

    @Transactional
    public CancellationResponse completeRelease(String cancellationId) {
        BookingCancellation cancellation = cancellationRepository.findById(cancellationId)
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
        Booking booking = bookingRepository.findByIdForUpdate(
                        cancellation.getBooking().getBookingId())
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setInventoryStatus(InventoryStatus.RELEASED);
        booking.getInventoryReservation().setStatus(InventoryStatus.RELEASED);
        booking.getInventoryReservation().setReleasedAt(OffsetDateTime.now(bookingClock));
        cancellation.setStatus(CancellationStatus.COMPLETED);
        cancellation.setCompletedAt(OffsetDateTime.now(bookingClock));
        cancellation.setAfterSnapshot(booking.getStatus().name());
        eventService.append(booking, "BOOKING_CANCELLED", cancellation.getCorrelationId());
        return response(cancellation, false);
    }

    @Transactional
    public void markReleaseFailure(String cancellationId, RuntimeException exception) {
        BookingCancellation cancellation = cancellationRepository.findById(cancellationId)
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
        cancellation.setStatus(CancellationStatus.MANUAL_REVIEW);
        cancellation.setAfterSnapshot("Inventory release failed: "
                + exception.getClass().getSimpleName());
    }

    @Transactional
    public CancellationResponse completeRefund(
            String cancellationId,
            String providerRefundReference) {
        BookingCancellation cancellation = cancellationRepository.findById(cancellationId)
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
        Booking booking = bookingRepository.findByIdForUpdate(
                        cancellation.getBooking().getBookingId())
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
        if (booking.getStatus() == BookingStatus.REFUNDED
                && cancellation.getStatus() == CancellationStatus.COMPLETED) {
            return response(cancellation, true);
        }

        Refund refund = cancellation.getRefund();
        if (refund == null) {
            throw new AppException(CANCELLATION_NOT_ALLOWED);
        }
        OffsetDateTime now = OffsetDateTime.now(bookingClock);
        refund.setStatus(RefundStatus.SUCCEEDED);
        refund.setRefundReference(providerRefundReference);
        refund.setCompletedAt(now);
        booking.setStatus(BookingStatus.REFUNDED);
        booking.setRefundStatus(RefundStatus.SUCCEEDED);
        booking.setInventoryStatus(InventoryStatus.CANCELLED);
        booking.getInventoryReservation().setStatus(InventoryStatus.CANCELLED);
        booking.getInventoryReservation().setReleasedAt(now);

        booking.getTickets().forEach(ticket -> ticket.setStatus(TicketStatus.CANCELLED));
        ticketRepository.saveAll(booking.getTickets());
        ticketPassRepository.findByBooking_BookingId(booking.getBookingId())
                .ifPresent(pass -> {
                    pass.setStatus(TicketPassStatus.REVOKED);
                    pass.setRevokedAt(now);
                    pass.setRevokedReason("Booking refunded");
                    ticketPassRepository.save(pass);
                });

        cancellation.setStatus(CancellationStatus.COMPLETED);
        cancellation.setCompletedAt(now);
        cancellation.setAfterSnapshot(booking.getStatus().name());
        eventService.append(booking, "BOOKING_REFUNDED", cancellation.getCorrelationId());
        return response(cancellation, false);
    }

    @Transactional
    public CancellationResponse markRefundForManualReview(
            String cancellationId,
            String evidence) {
        BookingCancellation cancellation = cancellationRepository.findById(cancellationId)
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
        Booking booking = bookingRepository.findByIdForUpdate(
                        cancellation.getBooking().getBookingId())
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
        if (cancellation.getRefund() != null
                && cancellation.getRefund().getStatus() != RefundStatus.SUCCEEDED) {
            cancellation.getRefund().setStatus(RefundStatus.UNKNOWN);
        }
        booking.setRefundStatus(RefundStatus.UNKNOWN);
        cancellation.setStatus(CancellationStatus.MANUAL_REVIEW);
        cancellation.setAfterSnapshot(evidence);
        createReconciliation(cancellation, booking, evidence);
        eventService.append(
                booking,
                "BOOKING_REFUND_RECONCILIATION_REQUIRED",
                cancellation.getCorrelationId());
        return response(cancellation, false);
    }

    @Transactional(readOnly = true)
    public CancellationResponse current(String cancellationId, boolean replayed) {
        return response(cancellationRepository.findById(cancellationId)
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND)), replayed);
    }

    private void validateEligibility(Booking booking) {
        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT
                && booking.getStatus() != BookingStatus.CONFIRM_PENDING
                && booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new AppException(CANCELLATION_NOT_ALLOWED);
        }
        ZonedDateTime showtime = ZonedDateTime.of(
                booking.getShowDate(),
                booking.getStartTime(),
                ZoneId.of(booking.getShowtimeTimezone()));
        if (!showtime.minusMinutes(cancellationCutoffMinutes)
                .isAfter(ZonedDateTime.now(bookingClock))) {
            throw new AppException(CANCELLATION_NOT_ALLOWED);
        }
        if (booking.getTickets().stream().anyMatch(ticket -> ticket.getStatus() == TicketStatus.USED)) {
            throw new AppException(CANCELLATION_NOT_ALLOWED);
        }
        if (booking.getStatus() == BookingStatus.CONFIRMED
                && (booking.getPaymentReference() == null
                || booking.getPaymentReference().isBlank())) {
            throw new AppException(CANCELLATION_NOT_ALLOWED);
        }
    }

    private CancellationInstruction instruction(
            BookingCancellation cancellation,
            Action action,
            boolean replayed) {
        Booking booking = cancellation.getBooking();
        return new CancellationInstruction(
                action,
                cancellation.getCancellationId(),
                booking.getBookingId(),
                booking.getShowtimeId(),
                booking.getHoldReference(),
                booking.getAccountId(),
                booking.getPaymentReference(),
                cancellation.getRefund() == null
                        ? null : cancellation.getRefund().getIdempotencyKey(),
                cancellation.getRefund() == null
                        ? null : cancellation.getRefund().getAmount(),
                booking.getCurrency(),
                cancellation.getReasonCode(),
                cancellation.getReason(),
                booking.getConcessionItems().stream()
                        .map(ConcessionItem::getExternalReservationId)
                        .filter(java.util.Objects::nonNull)
                        .findFirst()
                        .orElse(null),
                replayed);
    }

    private Action replayAction(BookingCancellation cancellation) {
        if (cancellation.getStatus() == CancellationStatus.COMPLETED) {
            return Action.NONE;
        }
        Booking booking = cancellation.getBooking();
        if (booking.getStatus() == BookingStatus.CANCEL_REQUESTED
                && booking.getInventoryStatus() == InventoryStatus.RELEASE_PENDING) {
            return Action.RELEASE_HOLD;
        }
        if (booking.getStatus() == BookingStatus.REFUND_PENDING
                && cancellation.getRefund() != null
                && cancellation.getRefund().getStatus() == RefundStatus.PENDING) {
            return Action.REQUEST_REFUND;
        }
        return Action.NONE;
    }

    private void createReconciliation(
            BookingCancellation cancellation,
            Booking booking,
            String evidence) {
        String idempotencyKey = "cancel-refund:" + cancellation.getCancellationId();
        if (reconciliationRepository.existsByIdempotencyKey(idempotencyKey)) {
            return;
        }
        reconciliationRepository.save(BookingReconciliation.builder()
                .booking(booking)
                .caseType("REFUND_OR_INVENTORY_COMPENSATION_FAILED")
                .severity("HIGH")
                .status(ReconciliationStatus.MANUAL_REVIEW)
                .paymentReference(booking.getPaymentReference())
                .holdReference(booking.getHoldReference())
                .clusterId(booking.getClusterId())
                .evidence(evidence)
                .ownerId("SYSTEM")
                .createdBy("BOOKING_SERVICE")
                .correlationId(cancellation.getCorrelationId())
                .idempotencyKey(idempotencyKey)
                .build());
    }

    private CancellationResponse response(
            BookingCancellation cancellation,
            boolean replayed) {
        Booking booking = cancellation.getBooking();
        Refund refund = cancellation.getRefund();
        return CancellationResponse.builder()
                .bookingId(booking.getBookingId())
                .cancellationId(cancellation.getCancellationId())
                .bookingStatus(booking.getStatus().name())
                .cancellationStatus(cancellation.getStatus().name())
                .refundStatus(booking.getRefundStatus().name())
                .refundAmount(refund == null ? BigDecimal.ZERO : refund.getAmount())
                .currency(booking.getCurrency())
                .replayed(replayed)
                .build();
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public enum Action {
        NONE,
        RELEASE_HOLD,
        REQUEST_REFUND
    }

    public record CancellationInstruction(
            Action action,
            String cancellationId,
            String bookingId,
            Long showtimeId,
            String holdId,
            String ownerId,
            String paymentReference,
            String refundIdempotencyKey,
            BigDecimal refundAmount,
            String currency,
            String reasonCode,
            String reason,
            String concessionReservationId,
            boolean replayed) {
    }
}
