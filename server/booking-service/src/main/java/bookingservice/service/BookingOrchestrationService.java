package bookingservice.service;

import bookingservice.client.MovieInventoryClient;
import bookingservice.dto.request.CreateBookingRequest;
import bookingservice.dto.request.MovieSeatHoldRequest;
import bookingservice.dto.response.CreateBookingResponse;
import bookingservice.dto.response.MovieSeatHoldResponse;
import bookingservice.dto.response.MovieShowtimeResponse;
import bookingservice.entity.Booking;
import bookingservice.repository.BookingRepository;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import static bookingservice.exception.BookingErrorCode.*;
import static bookingservice.service.BookingIdempotencyService.CREATE_BOOKING;

@Service
@RequiredArgsConstructor
public class BookingOrchestrationService {
    private final MovieInventoryClient movieInventoryClient;
    private final BookingIdempotencyService idempotencyService;
    private final BookingPersistenceService persistenceService;
    private final BookingRepository bookingRepository;
    private final BookingResponseMapper responseMapper;
    private final BookingAbuseGuard abuseGuard;

    @Value("${movie-service.internal-key}")
    private String movieServiceInternalKey;

    public CreateBookingResponse create(
            String accountId,
            String authorization,
            String idempotencyKey,
            CreateBookingRequest request) {
        validateRequest(accountId, authorization, idempotencyKey, request);

        String requestHash = requestHash(request);
        String correlationId = UUID.randomUUID().toString();
        BookingIdempotencyService.Claim claim = idempotencyService.claim(
                accountId,
                CREATE_BOOKING,
                idempotencyKey,
                requestHash,
                correlationId);
        if (!claim.owner()) {
            Booking replay = bookingRepository.findDetailedByBookingId(claim.replayBookingId())
                    .orElseThrow(() -> new AppException(SERVICE_UNAVAILABLE));
            return responseMapper.toCreateResponse(replay);
        }

        MovieSeatHoldResponse hold = null;
        try {
            abuseGuard.checkNewBooking(accountId);
            MovieShowtimeResponse showtime = requireResult(
                    movieInventoryClient.getPublicShowtime(request.getShowtimeId()));
            if (!"ON_SALE".equals(showtime.getStatus())) {
                throw new AppException(SHOWTIME_NOT_ON_SALE);
            }

            hold = requireResult(movieInventoryClient.holdSeats(
                    request.getShowtimeId(),
                    authorization,
                    idempotencyKey,
                    "WEB",
                    new MovieSeatHoldRequest(request.getSeatIds())));
            Booking booking = persistenceService.create(
                    accountId,
                    showtime,
                    hold,
                    idempotencyKey,
                    correlationId);
            return responseMapper.toCreateResponse(booking);
        } catch (AppException exception) {
            compensateHold(request.getShowtimeId(), hold, accountId);
            idempotencyService.markRetryable(accountId, CREATE_BOOKING, idempotencyKey);
            throw exception;
        } catch (FeignException exception) {
            compensateHold(request.getShowtimeId(), hold, accountId);
            idempotencyService.markRetryable(accountId, CREATE_BOOKING, idempotencyKey);
            if (exception.status() == 404 || exception.status() == 409) {
                throw new AppException(SEAT_HOLD_FAILED);
            }
            throw new AppException(SERVICE_UNAVAILABLE);
        } catch (RuntimeException exception) {
            compensateHold(request.getShowtimeId(), hold, accountId);
            idempotencyService.markRetryable(accountId, CREATE_BOOKING, idempotencyKey);
            throw exception;
        }
    }

    private void compensateHold(Long showtimeId, MovieSeatHoldResponse hold, String accountId) {
        if (hold == null || hold.getHoldId() == null) {
            return;
        }
        try {
            movieInventoryClient.releaseHold(
                    showtimeId,
                    hold.getHoldId(),
                    movieServiceInternalKey,
                    accountId);
        } catch (RuntimeException ignored) {
            // The persistent expiry job remains the final safety net for an orphan hold.
        }
    }

    private void validateRequest(
            String accountId,
            String authorization,
            String idempotencyKey,
            CreateBookingRequest request) {
        if (accountId == null || accountId.isBlank()
                || authorization == null || authorization.isBlank()) {
            throw new AppException(UNAUTHENTICATED);
        }
        if (idempotencyKey == null || idempotencyKey.isBlank()
                || request == null
                || request.getShowtimeId() == null
                || request.getSeatIds() == null
                || request.getSeatIds().isEmpty()
                || request.getSeatIds().size() != new HashSet<>(request.getSeatIds()).size()) {
            throw new AppException(INVALID_REQUEST);
        }
    }

    private String requestHash(CreateBookingRequest request) {
        List<Long> sortedSeats = request.getSeatIds().stream().sorted().toList();
        String canonical = request.getShowtimeId() + ":" + sortedSeats;
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private <T> T requireResult(ApiResponse<T> response) {
        if (response == null || response.getResult() == null) {
            throw new AppException(SERVICE_UNAVAILABLE);
        }
        return response.getResult();
    }
}
