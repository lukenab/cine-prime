package movieservice.exception;

import lombok.Getter;
import movieservice.dto.response.ReadinessViolation;

import java.util.List;

/**
 * MOV-03: thrown by MovieReadinessValidator when a movie fails a submit/approve/release gate.
 * Deliberately NOT an AppException subtype - server/common's AppException/GlobalExceptionHandler
 * only ever carry a fixed code+message and are shared by every microservice, so extending them
 * would mean changing shared infra just for movie-service's structured violations list. Instead
 * this is a movie-service-local exception caught by the movie-service-local
 * MovieReadinessExceptionHandler advice, which is safe: Spring resolves it to the most specific
 * matching @ExceptionHandler, so it never collides with the common module's handlers.
 */
@Getter
public class MovieReadinessException extends RuntimeException {

    private final MovieErrorCode errorCode;
    private final List<ReadinessViolation> violations;

    public MovieReadinessException(MovieErrorCode errorCode, List<ReadinessViolation> violations) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
        this.violations = violations;
    }
}
