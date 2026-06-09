package authservice.exception;

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
    USER_EXISTED(1001, "User has already exist!"),
    INVALID_PASSWORD(1002, "Password must be more than 8 characters!"),
    UNCATEGORIZED_EXCEPTION(1003, "Uncategorized error!"),
    USERNAME_INVALID(1004, "Username must be more than 3 characters!"),
    INVALID_KEY(1005, "Invalid message key!"),
    USER_NOT_FOUND(1006, "User not found!"),
    ERROR_UPDATE(1007, "Error updating user!"),
    UNAUTHENTICATED(1008, "Unauthenticated"),
    EMAIL_INVALID(1009, "Email must be follow format abc@xyz.com")
    ;
    int code;
    String message;
}
