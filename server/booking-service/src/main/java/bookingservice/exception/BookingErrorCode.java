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
        CANCEL_TIME_EXPIRED(2003, "Cancellation time has expired for this showtime", HttpStatus.BAD_REQUEST),
        BOOKING_NOT_FOUND(2004, "Booking not found", HttpStatus.NOT_FOUND),
        INVALID_SEAT_SELECTION(2005, "Selected seats are invalid or do not exist", HttpStatus.BAD_REQUEST),
        SEATS_ALREADY_TAKEN(2006, "The selected seats are already locked or booked by another user",
                        HttpStatus.BAD_REQUEST),
        SHOWTIME_NOT_AVAILABLE(2007, "The requested showtime does not exist or is not open for booking",
                        HttpStatus.BAD_REQUEST),
        INSUFFICIENT_POINTS(2008, "The member does not have enough points to complete this booking",
                        HttpStatus.BAD_REQUEST),
        DUPLICATE_SEATS_IN_REQUEST(2009, "Duplicate seat IDs found in the request", HttpStatus.BAD_REQUEST),
        MEMBER_ONLY_ACTION(2010, "Only registered members can create a booking and hold seats", HttpStatus.FORBIDDEN),
        SEAT_ALREADY_LOCKED(2011, "The seat is already locked or reserved by another user", HttpStatus.CONFLICT),
        SEAT_ALREADY_HELD_BY_YOU(2012, "You have already held this seat and the lock is still valid",
                        HttpStatus.BAD_REQUEST),
        SHOWTIME_INVENTORY_UNAVAILABLE(2013,
                        "Seat inventory is temporarily unavailable. Refresh the seat map and try again.",
                        HttpStatus.SERVICE_UNAVAILABLE),
        PROMOTION_NOT_APPLICABLE(2501, "PROMOTION_NOT_APPLICABLE", HttpStatus.CONFLICT),
        PROMOTION_QUOTA_EXHAUSTED(2502, "PROMOTION_QUOTA_EXHAUSTED", HttpStatus.CONFLICT),
        PROMOTION_SERVICE_UNAVAILABLE(2503, "PROMOTION_SERVICE_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE),
        INVALID_QUOTE_REQUEST(2505, "INVALID_QUOTE_REQUEST", HttpStatus.BAD_REQUEST),
        QUOTE_NOT_FOUND(2506, "QUOTE_NOT_FOUND", HttpStatus.NOT_FOUND),
        QUOTE_EXPIRED(2507, "QUOTE_EXPIRED", HttpStatus.GONE),
        QUOTE_OWNER_MISMATCH(2508, "QUOTE_OWNER_MISMATCH", HttpStatus.FORBIDDEN),
        QUOTE_PRICE_CHANGED(2509, "QUOTE_PRICE_CHANGED", HttpStatus.CONFLICT),
        PAYMENT_CONFIRM_PERMISSION_DENIED(2510, "PAYMENT_CONFIRM_PERMISSION_DENIED", HttpStatus.FORBIDDEN);

        int code;
        String message;
        HttpStatusCode statusCode;
}
