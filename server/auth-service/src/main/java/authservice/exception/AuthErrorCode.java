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
    ACCOUNT_INACTIVE(1020, "Your account has been deactivated. Please contact support.", HttpStatus.FORBIDDEN);

    int code;
    String message;
    HttpStatusCode statusCode;
}