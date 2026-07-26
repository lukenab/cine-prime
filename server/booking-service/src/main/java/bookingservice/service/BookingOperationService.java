package bookingservice.service;

import bookingservice.entity.IdempotencyRecord;
import bookingservice.entity.OperationStatus;
import bookingservice.exception.BookingErrorCode;
import bookingservice.repository.BookingOperationRepository;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
public class BookingOperationService {
    private final BookingOperationRepository repository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public IdempotencyRecord begin(String callerScope, String key, String requestHash, String correlationId) {
        return repository.findByCallerScopeAndOperationScopeAndIdempotencyKey(callerScope, "CREATE_BOOKING", key)
                .map(existing -> {
                    if (!existing.getRequestHash().equals(requestHash)) {
                        throw new AppException(BookingErrorCode.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST);
                    }
                    return existing;
                })
                .orElseGet(() -> repository.save(IdempotencyRecord.builder()
                        .callerScope(callerScope)
                        .operationScope("CREATE_BOOKING")
                        .idempotencyKey(key)
                        .requestHash(requestHash)
                        .status(OperationStatus.IN_PROGRESS)
                        .pollReference(correlationId)
                        .correlationId(correlationId)
                        .expiresAt(OffsetDateTime.now().plusDays(7))
                        .build()));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void succeed(String operationId, bookingservice.entity.Booking booking, String responseSnapshot) {
        IdempotencyRecord operation = repository.findById(operationId).orElseThrow();
        operation.setBooking(booking);
        operation.setStatus(OperationStatus.SUCCEEDED);
        operation.setHttpStatus(201);
        operation.setResponseBody(responseSnapshot);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void retryableFailure(String operationId) {
        repository.findById(operationId).ifPresent(operation ->
                operation.setStatus(OperationStatus.FAILED_RETRYABLE));
    }
}
