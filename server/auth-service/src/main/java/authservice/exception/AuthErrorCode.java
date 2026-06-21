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
    ROLE_NOT_FOUND(1012, "Default role not found!", HttpStatus.BAD_REQUEST),
    INVALID_OTP(1013, "Otp invalid", HttpStatus.BAD_REQUEST),
    ACCOUNT_NOT_FOUND(1014, "Account not found!", HttpStatus.BAD_REQUEST),
    OTP_EXPIRED(1015, "Otp has expired", HttpStatus.BAD_REQUEST),
    RESEND_OTP_TOO_FAST(1016, "Resend Otp too fast", HttpStatus.TOO_MANY_REQUESTS),
    PHONE_EXISTED(1017, "Phone number already exists in the system!", HttpStatus.BAD_REQUEST),
    IDENTITY_CARD_EXISTED(1018, "Identity card (CCCD) already exists in the system!", HttpStatus.BAD_REQUEST);

    int code;
    String message;
    HttpStatusCode statusCode;
}