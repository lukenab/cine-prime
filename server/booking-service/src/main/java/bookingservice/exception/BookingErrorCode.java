package bookingservice.exception;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.experimental.FieldDefaults;
import movie.theater.common.exception.BaseErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@Getter
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@AllArgsConstructor
public enum BookingErrorCode implements BaseErrorCode {
    INVALID_BOOKING_STATE(2001, "Booking cannot be cancelled in its current state", HttpStatus.BAD_REQUEST),
    CANCEL_PERMISSION_DENIED(2002, "You do not have permission to cancel this booking", HttpStatus.FORBIDDEN),
    CANCEL_TIME_EXPIRED(2003, "Cannot cancel booking less than %d minutes before showtime", HttpStatus.BAD_REQUEST),
    BOOKING_NOT_FOUND(2004, "Booking not found", HttpStatus.NOT_FOUND);

    int code;
    String message;
    HttpStatusCode statusCode;
}