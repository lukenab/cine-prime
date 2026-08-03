package paymentservice.exception;

import lombok.Getter;
import movie.theater.common.exception.BaseErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@Getter
public enum PaymentErrorCode implements BaseErrorCode {
    UNAUTHENTICATED(5101, "Authentication is required.", HttpStatus.UNAUTHORIZED),
    INVALID_REQUEST(5102, "Payment request is invalid.", HttpStatus.BAD_REQUEST),
    PAYMENT_NOT_FOUND(5103, "Payment attempt was not found.", HttpStatus.NOT_FOUND),
    PAYMENT_FORBIDDEN(5104, "You are not allowed to access this payment.", HttpStatus.FORBIDDEN),
    BOOKING_NOT_PAYABLE(5105, "Booking is no longer awaiting payment.", HttpStatus.CONFLICT),
    BOOKING_EXPIRED(5106, "Booking has expired. Please select the seats again.", HttpStatus.CONFLICT),
    IDEMPOTENCY_CONFLICT(5107, "Idempotency key was reused for a different payment request.", HttpStatus.CONFLICT),
    PROVIDER_NOT_CONFIGURED(5108, "VNPAY sandbox credentials are not configured.", HttpStatus.SERVICE_UNAVAILABLE),
    CALLBACK_INVALID(5109, "Payment provider callback signature is invalid.", HttpStatus.UNAUTHORIZED),
    PAYMENT_AMOUNT_MISMATCH(5110, "Provider amount does not match the payment snapshot.", HttpStatus.CONFLICT),
    RATE_LIMITED(5111, "Too many payment sessions were created. Please retry shortly.", HttpStatus.TOO_MANY_REQUESTS),
    INVALID_INTERNAL_CREDENTIAL(5112, "Internal service credential is invalid.", HttpStatus.FORBIDDEN),
    REFUND_NOT_ALLOWED(5113, "This payment is not eligible for refund.", HttpStatus.CONFLICT),
    REFUND_AMOUNT_MISMATCH(5114, "Refund amount exceeds the paid amount.", HttpStatus.CONFLICT),
    BOOKING_SERVICE_UNAVAILABLE(5198, "Booking service is temporarily unavailable.", HttpStatus.SERVICE_UNAVAILABLE),
    OUTCOME_DELIVERY_FAILED(5199, "Payment was recorded but booking confirmation is pending reconciliation.", HttpStatus.ACCEPTED);

    private final int code;
    private final String message;
    private final HttpStatusCode statusCode;

    PaymentErrorCode(int code, String message, HttpStatusCode statusCode) {
        this.code = code;
        this.message = message;
        this.statusCode = statusCode;
    }
}
