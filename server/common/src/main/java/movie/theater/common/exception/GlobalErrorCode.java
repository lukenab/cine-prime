package movie.theater.common.exception;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@Getter
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public enum GlobalErrorCode implements BaseErrorCode {
    UNCATEGORIZED_EXCEPTION(1003, "An unexpected error occurred. Please try again later.", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_KEY(1005, "Invalid request field!", HttpStatus.BAD_REQUEST),
    DATA_INTEGRITY_VIOLATION(1006, "Data already exists or conflicts with an existing record.", HttpStatus.CONFLICT),
    UNAUTHENTICATED(1008, "Unauthenticated!", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(1009, "You do not have permission!", HttpStatus.FORBIDDEN),
    INVALID_AGE(2001, "Your age must be at least {min} years old!", HttpStatus.BAD_REQUEST),
    CONCURRENT_MODIFICATION(1010,
            "This record was modified by someone else in the meantime. Reload and try again.",
            HttpStatus.CONFLICT),
    ;

    int code;
    String message;
    HttpStatusCode statusCode;
}