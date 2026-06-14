package userservice.exception;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.experimental.FieldDefaults;
import movie.theater.common.exception.BaseErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@Getter
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public enum ErrorCode implements BaseErrorCode {
    PHONE_EXISTED(2001, "Phone number already exists!", HttpStatus.BAD_REQUEST),
    IDENTITY_CARD_EXISTED(2002, "Identity card already exists!", HttpStatus.BAD_REQUEST),
    USER_NOT_FOUND(2003, "User profile not found!", HttpStatus.NOT_FOUND)
    ;

    int code;
    String message;
    HttpStatusCode statusCode;
}
