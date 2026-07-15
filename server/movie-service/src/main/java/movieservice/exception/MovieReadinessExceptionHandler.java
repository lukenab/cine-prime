package movieservice.exception;

import lombok.extern.slf4j.Slf4j;
import movie.theater.common.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Movie-service-local advice (does not touch server/common) so MOV-03's readiness errors can carry
 * a structured `result.violations[]` payload instead of just code+message - see
 * MovieReadinessException for why this isn't folded into the shared AppException/GlobalExceptionHandler.
 */
@Slf4j
@RestControllerAdvice
public class MovieReadinessExceptionHandler {

    @ExceptionHandler(MovieReadinessException.class)
    public ResponseEntity<ApiResponse<?>> handleMovieReadiness(MovieReadinessException exception) {
        MovieErrorCode errorCode = exception.getErrorCode();
        ApiResponse<?> response = ApiResponse.builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage())
                .result(Map.of("violations", exception.getViolations()))
                .build();
        return ResponseEntity.status(errorCode.getStatusCode()).body(response);
    }
}
