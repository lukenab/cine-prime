package bookingservice.exception;

import lombok.Getter;
import movie.theater.common.exception.BaseErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@Getter
public enum BookingErrorCode implements BaseErrorCode {
    // Common errors (4101-4120)
    UNAUTHENTICATED(4101, "Authentication is required.", HttpStatus.UNAUTHORIZED),
    INVALID_REQUEST(4102, "Booking request is invalid.", HttpStatus.BAD_REQUEST),
    IDEMPOTENCY_CONFLICT(4103, "Idempotency key was reused with a different request.", HttpStatus.CONFLICT),
    SHOWTIME_NOT_ON_SALE(4104, "Showtime is not open for ticket sales.", HttpStatus.CONFLICT),
    SEAT_HOLD_FAILED(4105, "Selected seats are no longer available.", HttpStatus.CONFLICT),
    BOOKING_NOT_FOUND(4106, "Booking was not found.", HttpStatus.NOT_FOUND),
    BOOKING_FORBIDDEN(4107, "You are not allowed to access this booking.", HttpStatus.FORBIDDEN),
    BOOKING_NOT_PAYABLE(4108, "Booking is not awaiting payment.", HttpStatus.CONFLICT),
    PAYMENT_EVENT_INVALID(4109, "Payment callback signature or payload is invalid.", HttpStatus.UNAUTHORIZED),
    PAYMENT_AMOUNT_MISMATCH(4110, "Payment amount or currency does not match the booking snapshot.", HttpStatus.CONFLICT),
    BOOKING_EXPIRED(4111, "Booking has expired.", HttpStatus.CONFLICT),
    INVENTORY_CONFIRMATION_FAILED(4112, "Payment was received but seat confirmation requires reconciliation.", HttpStatus.CONFLICT),
    CANCELLATION_NOT_ALLOWED(4113, "Booking is not eligible for cancellation.", HttpStatus.CONFLICT),
    CLUSTER_ACCESS_DENIED(4114, "You are not allowed to operate bookings for this cinema cluster.", HttpStatus.FORBIDDEN),
    TICKET_PASS_NOT_FOUND(4115, "Ticket pass was not found.", HttpStatus.NOT_FOUND),
    TICKET_PASS_INVALID(4116, "Ticket pass is invalid or has been revoked.", HttpStatus.CONFLICT),
    TICKET_ALREADY_USED(4117, "Ticket has already been checked in.", HttpStatus.CONFLICT),
    BOOKING_RATE_LIMITED(4118, "Too many booking attempts. Please wait before trying again.", HttpStatus.TOO_MANY_REQUESTS),
    TOO_MANY_ACTIVE_BOOKINGS(4119, "Complete or release an existing pending booking before creating another.", HttpStatus.CONFLICT),
    COUNTER_PAYMENT_INVALID(4120, "Counter payment information is invalid.", HttpStatus.BAD_REQUEST),
    COUNTER_SALE_FINALIZATION_FAILED(4121, "Seats were reserved but the counter sale requires reconciliation.", HttpStatus.CONFLICT),
    CONCESSION_RESERVATION_FAILED(4122, "Concession items could not be reserved.", HttpStatus.CONFLICT),
    CONCESSION_ALREADY_ATTACHED(4123, "This booking already has concession items.", HttpStatus.CONFLICT),

    // Legacy errors (2001-2013) - kept for backward compatibility
    INVALID_BOOKING_STATE(2001, "Booking cannot be cancelled in its current state", HttpStatus.BAD_REQUEST),
    CANCEL_PERMISSION_DENIED(2002, "You do not have permission to cancel this booking", HttpStatus.FORBIDDEN),
    CANCEL_TIME_EXPIRED(2003, "Cancellation time has expired for this showtime", HttpStatus.BAD_REQUEST),
    INVALID_SEAT_SELECTION(2005, "Selected seats are invalid or do not exist", HttpStatus.BAD_REQUEST),
    SEATS_ALREADY_TAKEN(2006, "The selected seats are already locked or booked by another user", HttpStatus.BAD_REQUEST),
    SHOWTIME_NOT_AVAILABLE(2007, "The requested showtime does not exist or is not open for booking", HttpStatus.BAD_REQUEST),
    INSUFFICIENT_POINTS(2008, "The member does not have enough points to complete this booking", HttpStatus.BAD_REQUEST),
    DUPLICATE_SEATS_IN_REQUEST(2009, "Duplicate seat IDs found in the request", HttpStatus.BAD_REQUEST),
    MEMBER_ONLY_ACTION(2010, "Only registered members can create a booking and hold seats", HttpStatus.FORBIDDEN),
    SEAT_ALREADY_LOCKED(2011, "The seat is already locked or reserved by another user", HttpStatus.CONFLICT),
    SEAT_ALREADY_HELD_BY_YOU(2012, "You have already held this seat and the lock is still valid", HttpStatus.BAD_REQUEST),
    SHOWTIME_INVENTORY_UNAVAILABLE(2013, "Seat inventory is temporarily unavailable. Refresh the seat map and try again.", HttpStatus.SERVICE_UNAVAILABLE),

    // Promotion errors (2501-2510)
    PROMOTION_NOT_APPLICABLE(2501, "PROMOTION_NOT_APPLICABLE", HttpStatus.CONFLICT),
    PROMOTION_QUOTA_EXHAUSTED(2502, "PROMOTION_QUOTA_EXHAUSTED", HttpStatus.CONFLICT),
    PROMOTION_SERVICE_UNAVAILABLE(2503, "PROMOTION_SERVICE_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE),
    INVALID_QUOTE_REQUEST(2505, "INVALID_QUOTE_REQUEST", HttpStatus.BAD_REQUEST),
    QUOTE_NOT_FOUND(2506, "QUOTE_NOT_FOUND", HttpStatus.NOT_FOUND),
    QUOTE_EXPIRED(2507, "QUOTE_EXPIRED", HttpStatus.GONE),
    QUOTE_OWNER_MISMATCH(2508, "QUOTE_OWNER_MISMATCH", HttpStatus.FORBIDDEN),
    QUOTE_PRICE_CHANGED(2509, "QUOTE_PRICE_CHANGED", HttpStatus.CONFLICT),
    PAYMENT_CONFIRM_PERMISSION_DENIED(2510, "PAYMENT_CONFIRM_PERMISSION_DENIED", HttpStatus.FORBIDDEN),

    SERVICE_UNAVAILABLE(4199, "A required booking dependency is temporarily unavailable.", HttpStatus.SERVICE_UNAVAILABLE);

    private final int code;
    private final String message;
    private final HttpStatusCode statusCode;

    BookingErrorCode(int code, String message, HttpStatusCode statusCode) {
        this.code = code;
        this.message = message;
        this.statusCode = statusCode;
    }
}
