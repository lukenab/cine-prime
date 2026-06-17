package authservice.exception;

import lombok.extern.slf4j.Slf4j;
import movie.theater.common.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;

@Slf4j
public class AuthGlobalHandler {
    @ExceptionHandler(value = HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handlingHttpMessageNotReadableException(HttpMessageNotReadableException exception) {
        log.error("JSON Parse Error: ", exception);

        ApiResponse<Void> apiResponse = ApiResponse.<Void>builder()
                .code(400)
                .message("Invalid input data format.")
                .build();

        return ResponseEntity.badRequest().body(apiResponse);
    }
}
