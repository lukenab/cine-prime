package movieservice.exception;

import movie.theater.common.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/// Tráº£ chi tiáº¿t movie khÃ´ng eligible trong result, Ä‘á»ƒ admin sá»­a dá»¯ liá»‡u trÆ°á»›c khi submit láº¡i batch.
@RestControllerAdvice
public class AutoShowtimePreflightExceptionHandler {

    @ExceptionHandler(AutoShowtimePreflightException.class)
    public ResponseEntity<ApiResponse<?>> handlePreflight(
            AutoShowtimePreflightException exception
    ) {
        MovieErrorCode errorCode = exception.getErrorCode();
        ApiResponse<?> response = ApiResponse.builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage())
                .result(Map.of("ineligibleMovies", exception.getIneligibleMovies()))
                .build();

        return ResponseEntity.status(errorCode.getStatusCode()).body(response);
    }
}
