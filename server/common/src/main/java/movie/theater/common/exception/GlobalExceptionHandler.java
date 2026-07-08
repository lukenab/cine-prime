package movie.theater.common.exception;

import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import jakarta.validation.ConstraintViolation;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Arrays;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String MIN_ATTRIBUTE = "min";
    private static final String VALUE_ATTRIBUTE = "value";

    @ExceptionHandler(value = RuntimeException.class)
    ResponseEntity<ApiResponse<?>> handlingRuntimeException(RuntimeException exception){
        log.error("Unhandled exception: ", exception);
        GlobalErrorCode errorCode = GlobalErrorCode.UNCATEGORIZED_EXCEPTION;
        ApiResponse<?> apiResponse = ApiResponse.builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage())
                .build();
        return ResponseEntity.status(errorCode.getStatusCode()).body(apiResponse);
    }

    @ExceptionHandler(value = AppException.class)
    ResponseEntity<ApiResponse<?>> handlingAppException(AppException exception){
        BaseErrorCode errorCode = exception.getErrorCode();
        ApiResponse<?> apiResponse = ApiResponse.builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage())
                .build();
        return ResponseEntity
                .status(errorCode.getStatusCode())
                .body(apiResponse);
    }

    @ExceptionHandler(value = MethodArgumentNotValidException.class)
    ResponseEntity<ApiResponse<?>> handlingValidation(MethodArgumentNotValidException exception){
        String validationMessage = exception.getFieldError() != null
                ? exception.getFieldError().getDefaultMessage()
                : GlobalErrorCode.INVALID_KEY.getMessage();
        GlobalErrorCode errorCode = GlobalErrorCode.INVALID_KEY;

        Map<String, Object> attributes = null;

        try {
            errorCode = GlobalErrorCode.valueOf(validationMessage);

            var constraintViolation = exception.getBindingResult()
                    .getAllErrors().get(0).unwrap(ConstraintViolation.class);


            attributes = constraintViolation.getConstraintDescriptor().getAttributes();
            log.debug(attributes.toString());

        } catch (IllegalArgumentException e) {
            log.warn("Unrecognized validation message key: {}", validationMessage);
        }
        ApiResponse<?> apiResponse = ApiResponse.builder()
                .code(errorCode.getCode())
                .message(Objects.nonNull(attributes) ? mapAttribute(errorCode.getMessage(), attributes)
                        : validationMessage)
                .build();
        return ResponseEntity.badRequest().body(apiResponse);
    }

    @ExceptionHandler(value = HttpMessageNotReadableException.class)
    ResponseEntity<ApiResponse<?>> handlingUnreadableRequest(HttpMessageNotReadableException exception){
        log.warn("Invalid request body: {}", exception.getMessage());
        GlobalErrorCode errorCode = GlobalErrorCode.INVALID_KEY;
        String message = "Invalid request body or date format!";

        Throwable cause = exception.getCause();
        if (cause instanceof InvalidFormatException ife
                && ife.getTargetType() != null
                && ife.getTargetType().isEnum()) {
            String field = ife.getPath().stream()
                    .map(ref -> ref.getFieldName())
                    .collect(Collectors.joining("."));
            String accepted = Arrays.stream(ife.getTargetType().getEnumConstants())
                    .map(Object::toString)
                    .collect(Collectors.joining(", "));
            message = "Invalid value '" + ife.getValue() + "' for field '" + field
                    + "'. Accepted values: [" + accepted + "]";
        }

        ApiResponse<?> apiResponse = ApiResponse.builder()
                .code(errorCode.getCode())
                .message(message)
                .build();
        return ResponseEntity.badRequest().body(apiResponse);
    }
    private String mapAttribute(String message, Map<String, Object> attributes) {
        // @Size uses "min"; @Min uses "value" — resolve whichever is present
        Object minRaw = attributes.containsKey(MIN_ATTRIBUTE)
                ? attributes.get(MIN_ATTRIBUTE)
                : attributes.get(VALUE_ATTRIBUTE);

        return message.replace("{" + MIN_ATTRIBUTE + "}", String.valueOf(minRaw));
    }

    // DB unique constraint bị vi phạm (race condition, duplicate insert...)
    // Ví dụ: 2 request đăng ký cùng username đồng thời qua được service check nhưng bị DB chặn
    @ExceptionHandler(value = DataIntegrityViolationException.class)
    ResponseEntity<ApiResponse<?>> handlingDataIntegrity(DataIntegrityViolationException exception) {
        log.error("Data integrity violation: ", exception);
        GlobalErrorCode errorCode = GlobalErrorCode.DATA_INTEGRITY_VIOLATION;
        return ResponseEntity.status(errorCode.getStatusCode()).body(ApiResponse.builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage())
                .build());
    }

    @ExceptionHandler(value = AccessDeniedException.class)
    ResponseEntity<ApiResponse<?>> handlingAccessDeniedException(AccessDeniedException exception) {
        GlobalErrorCode errorCode = GlobalErrorCode.UNAUTHORIZED;
        return ResponseEntity.status(errorCode.getStatusCode()).body(ApiResponse.builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage())
                .build());
    }
}
