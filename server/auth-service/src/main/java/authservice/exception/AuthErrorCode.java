package authservice.exception;

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
public enum AuthErrorCode implements BaseErrorCode {
    USERNAME_EXISTED(1010, "Username already exists!", HttpStatus.BAD_REQUEST),
    EMAIL_EXISTED(1011, "Email already exists!", HttpStatus.BAD_REQUEST),
    ROLE_NOT_FOUND(1012, "An internal error occurred. Please contact support.", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_OTP(1013, "OTP is invalid!", HttpStatus.BAD_REQUEST),
    ACCOUNT_NOT_FOUND(1014, "Account not found!", HttpStatus.NOT_FOUND),
    OTP_EXPIRED(1015, "OTP has expired!", HttpStatus.BAD_REQUEST),
    RESEND_OTP_TOO_FAST(1016, "Please wait before requesting another OTP!", HttpStatus.TOO_MANY_REQUESTS),
    PHONE_EXISTED(1017, "Phone number already exists in the system!", HttpStatus.BAD_REQUEST),
    IDENTITY_CARD_EXISTED(1018, "Identity card (CCCD) already exists in the system!", HttpStatus.BAD_REQUEST),
    EMAIL_SEND_FAILED(1019, "Failed to send OTP email. Please try again.", HttpStatus.INTERNAL_SERVER_ERROR),
    ACCOUNT_INACTIVE(1020, "Your account has been deactivated. Please contact support.", HttpStatus.FORBIDDEN),
    ACCOUNT_LOCKED(1021, "Your account has been temporarily locked due to too many failed login attempts. Please try again later.", HttpStatus.FORBIDDEN),
    TOKEN_EXPIRED(1022, "Your session has expired. Please log in again.", HttpStatus.UNAUTHORIZED),
    TOKEN_INVALID(1023, "Invalid token. Please log in again.", HttpStatus.UNAUTHORIZED),
    TOKEN_REVOKED(1024, "This session has been logged out. Please log in again.", HttpStatus.UNAUTHORIZED),
    REGISTRATION_NOT_INITIATED(1025, "Registration has not been initiated!", HttpStatus.BAD_REQUEST),

    // --- Account activation (Issue #161 — invite-link flow) ---
    ACTIVATION_TOKEN_INVALID(1026, "Invalid activation link.", HttpStatus.BAD_REQUEST),
    ACTIVATION_TOKEN_EXPIRED(1027, "Activation link has expired. Please ask your admin to resend it.", HttpStatus.BAD_REQUEST),
    ACTIVATION_TOKEN_ALREADY_USED(1028, "This activation link has already been used.", HttpStatus.BAD_REQUEST),
    ACCOUNT_PENDING_ACTIVATION(1029, "Your account has not been activated yet. Please check your email for the activation link.", HttpStatus.FORBIDDEN),
    ACCOUNT_ALREADY_ACTIVE(1030, "This account has already been activated.", HttpStatus.BAD_REQUEST),
    RATE_LIMIT_EXCEEDED(1031, "Too many requests. Please wait and try again.", HttpStatus.TOO_MANY_REQUESTS),
    INVALID_PAGE_REQUEST(1032, "Page must be at least 1 and size must be between 1 and 100.", HttpStatus.BAD_REQUEST);

    int code;
    String message;
    HttpStatusCode statusCode;
}
