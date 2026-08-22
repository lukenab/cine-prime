package workforceservice.exception;

import lombok.Getter;
import movie.theater.common.exception.BaseErrorCode;
import org.springframework.http.*;

@Getter
public enum WorkforceErrorCode implements BaseErrorCode {
    NOT_FOUND(6101, "The requested workforce record was not found.", HttpStatus.NOT_FOUND),
    INVALID_STATE(6102, "This workforce action is not allowed in the current state.", HttpStatus.CONFLICT),
    INVALID_PERIOD(6103, "The date or time period is invalid.", HttpStatus.BAD_REQUEST),
    EMPLOYEE_UNAVAILABLE(6104, "The employee has no active assignment for this cinema cluster.", HttpStatus.CONFLICT),
    SHIFT_OVERLAP(6105, "The employee already has an overlapping shift.", HttpStatus.CONFLICT),
    MINIMUM_REST_VIOLATION(6106, "The shift does not provide the required rest period.", HttpStatus.CONFLICT),
    CLUSTER_FORBIDDEN(6107, "You are not authorized for this cinema cluster.", HttpStatus.FORBIDDEN),
    SELF_APPROVAL_FORBIDDEN(6108, "A submitter cannot approve their own workforce request.", HttpStatus.FORBIDDEN),
    IDEMPOTENCY_CONFLICT(6109, "The idempotency key was already used for another punch.", HttpStatus.CONFLICT),
    CLOCK_SEQUENCE_INVALID(6110, "Clock-in and clock-out must follow the expected sequence.", HttpStatus.CONFLICT),
    UNRESOLVED_EXCEPTIONS(6111, "Resolve or waive attendance exceptions before approval.", HttpStatus.CONFLICT),
    UNSUPPORTED_EVENT(6112, "The staff projection event is invalid.", HttpStatus.BAD_REQUEST),
    REQUEST_ALREADY_ACTIVE(6113, "An active request already exists for this item.", HttpStatus.CONFLICT),
    EVENT_SERIALIZATION_FAILED(6114, "The workforce event could not be recorded.", HttpStatus.INTERNAL_SERVER_ERROR);

    private final int code; private final String message; private final HttpStatusCode statusCode;
    WorkforceErrorCode(int code, String message, HttpStatusCode statusCode) {
        this.code = code; this.message = message; this.statusCode = statusCode;
    }
}
