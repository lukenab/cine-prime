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
    USER_NOT_FOUND(2003, "User profile not found!", HttpStatus.NOT_FOUND),
    INVALID_INPUT(2004, "Invalid input data!", HttpStatus.BAD_REQUEST),
    EMAIL_EXISTED(2005, "Email already exists!", HttpStatus.BAD_REQUEST),
    AGE_TOO_YOUNG(2007, "User must be at least 18 years old", HttpStatus.BAD_REQUEST),
    AGE_INVALID(2008, "Invalid age! Age must be beetween 18 and 100 yearolds!", HttpStatus.BAD_REQUEST),
    USER_ALREADY_INACTIVE(2010, "User is already inactive", HttpStatus.BAD_REQUEST),
    USER_ALREADY_ACTIVE(2011, "User is already active", HttpStatus.BAD_REQUEST),
    EMPLOYEE_NOT_FOUND(2020, "Employee not found!", HttpStatus.NOT_FOUND),
    EMPLOYEE_ALREADY_DISABLED(2021, "Employee is already disabled!", HttpStatus.BAD_REQUEST),
    ACCOUNT_ALREADY_EMPLOYEE(2022, "This account is already linked to an employee!", HttpStatus.CONFLICT),
    INVALID_FILE(2030, "Invalid file. Only image files are accepted!", HttpStatus.BAD_REQUEST),
    UPLOAD_FAILED(2031, "Failed to upload image. Please try again!", HttpStatus.INTERNAL_SERVER_ERROR)
    ;

    int code;
    String message;
    HttpStatusCode statusCode;
}
