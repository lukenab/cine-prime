package bookingservice.service;

import bookingservice.entity.IdempotencyRecord;
import bookingservice.entity.BookingStatus;
import bookingservice.entity.OperationStatus;
import bookingservice.repository.IdempotencyRecordRepository;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;

import static bookingservice.exception.BookingErrorCode.IDEMPOTENCY_CONFLICT;
import static bookingservice.exception.BookingErrorCode.SERVICE_UNAVAILABLE;

@Service
@RequiredArgsConstructor
public class BookingIdempotencyService {
    public static final String CREATE_BOOKING = "CREATE_BOOKING";
    public static final String CREATE_COUNTER_BOOKING = "CREATE_COUNTER_BOOKING";

    private final IdempotencyRecordRepository repository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Claim claim(String callerScope, String operation, String key, String requestHash, String correlationId) {
        Optional<IdempotencyRecord> existing = repository
                .findByCallerScopeAndOperationScopeAndIdempotencyKey(callerScope, operation, key);
        if (existing.isPresent()) {
            return evaluate(existing.get(), requestHash);
        }

        try {
            repository.saveAndFlush(IdempotencyRecord.builder()
                    .callerScope(callerScope)
                    .operationScope(operation)
                    .idempotencyKey(key)
                    .requestHash(requestHash)
                    .status(OperationStatus.IN_PROGRESS)
                    .correlationId(correlationId)
                    .expiresAt(OffsetDateTime.now().plusHours(24))
                    .build());
            return new Claim(true, null);
        } catch (DataIntegrityViolationException race) {
            IdempotencyRecord winner = repository
                    .findByCallerScopeAndOperationScopeAndIdempotencyKey(callerScope, operation, key)
                    .orElseThrow(() -> new AppException(SERVICE_UNAVAILABLE));
            return evaluate(winner, requestHash);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markRetryable(String callerScope, String operation, String key) {
        repository.findByCallerScopeAndOperationScopeAndIdempotencyKey(callerScope, operation, key)
                .ifPresent(record -> {
                    if (record.getStatus() == OperationStatus.IN_PROGRESS) {
                        record.setStatus(OperationStatus.FAILED_RETRYABLE);
                        repository.save(record);
                    }
                });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markSucceeded(
            String callerScope,
            String operation,
            String key,
            String bookingId) {
        IdempotencyRecord record = repository
                .findByCallerScopeAndOperationScopeAndIdempotencyKey(callerScope, operation, key)
                .orElseThrow(() -> new AppException(SERVICE_UNAVAILABLE));
        if (record.getBooking() == null
                || !record.getBooking().getBookingId().equals(bookingId)) {
            throw new AppException(SERVICE_UNAVAILABLE);
        }
        record.setStatus(OperationStatus.SUCCEEDED);
        record.setHttpStatus(201);
        repository.save(record);
    }

    private Claim evaluate(IdempotencyRecord existing, String requestHash) {
        if (!existing.getRequestHash().equals(requestHash)) {
            throw new AppException(IDEMPOTENCY_CONFLICT);
        }
        if (existing.getStatus() == OperationStatus.SUCCEEDED && existing.getBooking() != null) {
            return new Claim(false, existing.getBooking().getBookingId());
        }
        // Recover from the narrow window where the counter sale committed but the
        // idempotency record was not finalized yet.
        if (existing.getBooking() != null
                && existing.getBooking().getStatus() == BookingStatus.CONFIRMED) {
            existing.setStatus(OperationStatus.SUCCEEDED);
            existing.setHttpStatus(201);
            repository.save(existing);
            return new Claim(false, existing.getBooking().getBookingId());
        }
        if (existing.getStatus() == OperationStatus.FAILED_RETRYABLE) {
            existing.setStatus(OperationStatus.IN_PROGRESS);
            repository.save(existing);
            return new Claim(true, null);
        }
        throw new AppException(SERVICE_UNAVAILABLE);
    }

    public record Claim(boolean owner, String replayBookingId) {
    }
}
