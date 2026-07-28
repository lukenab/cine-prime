package movieservice.exception;

import java.util.Map;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.CannotSerializeTransactionException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.persistence.LockTimeoutException;
import jakarta.persistence.PessimisticLockException;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.dto.ApiResponse;

/**
 * Converts transient database contention into a stable retryable contract.
 */
@Slf4j
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SeatInventoryLockExceptionHandler {

    @ExceptionHandler({
            CannotAcquireLockException.class,
            CannotSerializeTransactionException.class,
            PessimisticLockingFailureException.class,
            LockTimeoutException.class,
            PessimisticLockException.class
    })
    public ResponseEntity<ApiResponse<?>> handleRetryableLockFailure(Exception exception) {
        MovieErrorCode errorCode = MovieErrorCode.SEAT_HOLD_RETRYABLE_CONFLICT;
        log.warn("Retryable seat inventory lock failure: {}", exception.getMessage());
        ApiResponse<?> response = ApiResponse.builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage())
                .result(Map.of(
                        "retryable", true,
                        "retryAfterSeconds", 1))
                .build();
        return ResponseEntity.status(errorCode.getStatusCode())
                .header(HttpHeaders.RETRY_AFTER, "1")
                .body(response);
    }
}
