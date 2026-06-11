package authservice.exception;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.FeignException;
import movie.theater.common.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class AuthGlobalExceptionHandler {

    @ExceptionHandler(FeignException.class)
    public ResponseEntity<ApiResponse<?>> handleFeignException(FeignException exception) {
        ApiResponse<?> apiResponse = ApiResponse.builder()
                .code(exception.status() > 0 ? exception.status() : 400)
                .build();
        try {
            String rawBody = exception.contentUTF8();
            ObjectMapper mapper = new ObjectMapper();
            JsonNode jsonNode = mapper.readTree(rawBody);

            if (jsonNode.has("errors") && jsonNode.get("errors").isArray() && !jsonNode.get("errors").isEmpty()) {
                apiResponse.setMessage(jsonNode.get("errors").get(0).get("defaultMessage").asText());
            } else if (jsonNode.has("message")) {
                apiResponse.setMessage(jsonNode.get("message").asText());
            } else {
                apiResponse.setMessage("Validation failed in user service.");
            }
        } catch (Exception e) {
            apiResponse.setMessage("Error communication between services.");
        }
        return ResponseEntity.badRequest().body(apiResponse);
    }
}