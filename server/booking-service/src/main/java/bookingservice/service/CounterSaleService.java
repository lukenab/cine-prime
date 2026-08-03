package bookingservice.service;

import bookingservice.client.MovieInventoryClient;
import bookingservice.dto.request.ConfirmMovieSeatHoldRequest;
import bookingservice.dto.request.CounterSaleRequest;
import bookingservice.dto.request.MovieSeatHoldRequest;
import bookingservice.dto.response.CounterSaleResponse;
import bookingservice.dto.response.MovieSeatHoldResponse;
import bookingservice.dto.response.MovieShowtimeResponse;
import bookingservice.entity.Booking;
import bookingservice.repository.BookingRepository;
import bookingservice.repository.CounterPaymentRepository;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.UUID;

import static bookingservice.exception.BookingErrorCode.*;
import static bookingservice.service.BookingIdempotencyService.CREATE_COUNTER_BOOKING;

@Service
@RequiredArgsConstructor
@Slf4j
public class CounterSaleService {
    private final MovieInventoryClient movieInventoryClient;
    private final BookingIdempotencyService idempotencyService;
    private final BookingPersistenceService persistenceService;
    private final BookingRepository bookingRepository;
    private final CounterPaymentRepository counterPaymentRepository;
    private final PaymentProcessingStateService paymentStateService;

    @Value("${movie-service.internal-key}")
    private String movieServiceInternalKey;

    public CounterSaleResponse create(
            Long clusterId,
            String cashierId,
            String authorization,
            String idempotencyKey,
            CounterSaleRequest request) {
        validate(clusterId, cashierId, authorization, idempotencyKey, request);
        String requestHash = requestHash(clusterId, request);
        String correlationId = UUID.randomUUID().toString();
        BookingIdempotencyService.Claim claim = idempotencyService.claim(
                cashierId,
                CREATE_COUNTER_BOOKING,
                idempotencyKey,
                requestHash,
                correlationId);
        if (!claim.owner()) {
            return paymentStateService.currentCounterSale(claim.replayBookingId());
        }

        MovieSeatHoldResponse hold = null;
        Booking booking = null;
        boolean inventorySold = false;
        try {
            if (counterPaymentRepository.existsByReceiptReference(request.getReceiptReference().trim())) {
                throw new AppException(COUNTER_PAYMENT_INVALID);
            }
            MovieShowtimeResponse showtime = requireResult(
                    movieInventoryClient.getPublicShowtime(request.getShowtimeId()));
            if (!"ON_SALE".equals(showtime.getStatus())) {
                throw new AppException(SHOWTIME_NOT_ON_SALE);
            }
            if (!clusterId.equals(showtime.getClusterId())) {
                throw new AppException(CLUSTER_ACCESS_DENIED);
            }

            hold = requireResult(movieInventoryClient.holdSeats(
                    request.getShowtimeId(),
                    authorization,
                    idempotencyKey,
                    "COUNTER",
                    new MovieSeatHoldRequest(request.getSeatIds())));
            booking = persistenceService.createCounter(
                    cashierId,
                    showtime,
                    hold,
                    idempotencyKey,
                    correlationId);

            movieInventoryClient.confirmHold(
                    booking.getShowtimeId(),
                    booking.getHoldReference(),
                    movieServiceInternalKey,
                    cashierId,
                    new ConfirmMovieSeatHoldRequest(booking.getBookingId()));
            inventorySold = true;
            CounterSaleResponse response = paymentStateService.completeCounterSale(
                    booking.getBookingId(),
                    cashierId,
                    request.getTerminalId(),
                    request.getPaymentMethod(),
                    request.getReceiptReference(),
                    correlationId);
            try {
                idempotencyService.markSucceeded(
                        cashierId,
                        CREATE_COUNTER_BOOKING,
                        idempotencyKey,
                        booking.getBookingId());
            } catch (RuntimeException idempotencyException) {
                /*
                 * The business transaction has already completed: inventory is SOLD,
                 * the booking is CONFIRMED and the counter payment is recorded. Do not
                 * convert this into a false finalization failure. A retry is recovered
                 * by BookingIdempotencyService from the confirmed booking.
                 */
                log.warn(
                        "Counter sale {} completed but idempotency operation could not be finalized; "
                                + "the next retry will recover it",
                        booking.getBookingId(),
                        idempotencyException);
            }
            return response;
        } catch (RuntimeException exception) {
            if (inventorySold && booking != null) {
                paymentStateService.markCounterSaleFinalizationFailure(
                        booking.getBookingId(),
                        correlationId,
                        exception);
                throw new AppException(COUNTER_SALE_FINALIZATION_FAILED);
            }
            releaseHold(request.getShowtimeId(), hold, cashierId);
            if (booking != null) {
                paymentStateService.markCounterSaleCreationFailure(
                        booking.getBookingId(),
                        correlationId,
                        exception);
            }
            idempotencyService.markRetryable(
                    cashierId,
                    CREATE_COUNTER_BOOKING,
                    idempotencyKey);
            if (exception instanceof AppException appException) {
                throw appException;
            }
            if (exception instanceof FeignException feign
                    && (feign.status() == 404 || feign.status() == 409)) {
                throw new AppException(SEAT_HOLD_FAILED);
            }
            throw new AppException(SERVICE_UNAVAILABLE);
        }
    }

    private void validate(
            Long clusterId,
            String cashierId,
            String authorization,
            String idempotencyKey,
            CounterSaleRequest request) {
        if (clusterId == null
                || cashierId == null || cashierId.isBlank()
                || authorization == null || authorization.isBlank()
                || idempotencyKey == null || idempotencyKey.isBlank()
                || request == null
                || request.getShowtimeId() == null
                || request.getSeatIds() == null
                || request.getSeatIds().isEmpty()
                || request.getSeatIds().size() != new HashSet<>(request.getSeatIds()).size()
                || request.getTerminalId() == null || request.getTerminalId().isBlank()
                || request.getPaymentMethod() == null || request.getPaymentMethod().isBlank()
                || request.getReceiptReference() == null || request.getReceiptReference().isBlank()) {
            throw new AppException(INVALID_REQUEST);
        }
    }

    private String requestHash(Long clusterId, CounterSaleRequest request) {
        String canonical = clusterId + "|"
                + request.getShowtimeId() + "|"
                + request.getSeatIds().stream().sorted().toList() + "|"
                + request.getTerminalId().trim() + "|"
                + request.getPaymentMethod().trim().toUpperCase() + "|"
                + request.getReceiptReference().trim();
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private void releaseHold(Long showtimeId, MovieSeatHoldResponse hold, String cashierId) {
        if (hold == null || hold.getHoldId() == null) {
            return;
        }
        try {
            movieInventoryClient.releaseHold(
                    showtimeId,
                    hold.getHoldId(),
                    movieServiceInternalKey,
                    cashierId);
        } catch (RuntimeException ignored) {
            // Persistent hold expiry remains the safety net.
        }
    }

    private <T> T requireResult(ApiResponse<T> response) {
        if (response == null || response.getResult() == null) {
            throw new AppException(SERVICE_UNAVAILABLE);
        }
        return response.getResult();
    }
}
