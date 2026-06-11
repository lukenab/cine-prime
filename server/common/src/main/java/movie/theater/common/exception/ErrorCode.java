package movie.theater.common.exception;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public enum ErrorCode {
    UNCATEGORIZED_EXCEPTION(1003, "Uncategorized error!"),
    INVALID_KEY(1005, "Invalid message key!"),
    UNAUTHENTICATED(1008, "Unauthenticated"),

    // Auth-Service Errors
    USERNAME_EXISTED(1010, "Username already exists!"),
    EMAIL_EXISTED(1011, "Email already exists!"),
    ROLE_NOT_FOUND(1012, "Default role not found!"),

    // User-Service Errors
    PHONE_EXISTED(2001, "Phone number already exists!"),
    IDENTITY_CARD_EXISTED(2002, "Identity card already exists!"),
    USER_NOT_FOUND(2003, "User profile not found!")
    ;

    int code;
    String message;
}