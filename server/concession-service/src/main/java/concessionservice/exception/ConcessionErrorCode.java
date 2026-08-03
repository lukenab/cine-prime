package concessionservice.exception;

import lombok.Getter;
import movie.theater.common.exception.BaseErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@Getter
public enum ConcessionErrorCode implements BaseErrorCode {
    INVALID_REQUEST(5101, "Concession request is invalid.", HttpStatus.BAD_REQUEST),
    NOT_FOUND(5102, "Concession resource was not found.", HttpStatus.NOT_FOUND),
    NOT_AVAILABLE(5103, "One or more concession items are no longer available.", HttpStatus.CONFLICT),
    IDEMPOTENCY_CONFLICT(5104, "Idempotency key was reused with a different request.", HttpStatus.CONFLICT),
    INVALID_STATE(5105, "Concession reservation or order is not in the required state.", HttpStatus.CONFLICT),
    EXPIRED(5106, "Concession reservation has expired.", HttpStatus.CONFLICT),
    INTERNAL_UNAUTHORIZED(5107, "Internal service authentication failed.", HttpStatus.UNAUTHORIZED),
    CLUSTER_ACCESS_DENIED(5108, "You cannot fulfill orders for this cinema cluster.", HttpStatus.FORBIDDEN),
    PRODUCT_WORKFLOW_INVALID(5109, "The product is not in a valid state for this action.", HttpStatus.CONFLICT),
    CATALOG_ACCESS_DENIED(5110, "You cannot modify this concession product.", HttpStatus.FORBIDDEN),
    PRODUCT_VARIANT_REQUIRED(5111, "Add at least one active product variant before submitting for approval.", HttpStatus.CONFLICT),
    REJECTION_REASON_REQUIRED(5112, "A rejection reason is required.", HttpStatus.BAD_REQUEST),
    RESERVATION_ACCESS_DENIED(5113, "You cannot access this concession reservation.", HttpStatus.FORBIDDEN);

    private final int code;
    private final String message;
    private final HttpStatusCode statusCode;

    ConcessionErrorCode(int code, String message, HttpStatusCode statusCode) {
        this.code = code;
        this.message = message;
        this.statusCode = statusCode;
    }
}
