package commonservice.advice;

import commonservice.exception.*;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.fasterxml.jackson.databind.ObjectMapper;

import feign.FeignException;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class ExceptionAdvice {
        @ExceptionHandler(NotFoundException.class)
        public ResponseEntity<?> handleException(NotFoundException e) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                                Map.of(
                                                "code", "404",
                                                "message", e.getMessage(),
                                                "status", "NOT_FOUND"));
        }

        @ExceptionHandler(UnauthorizedException.class)
        public ResponseEntity<?> handleUnauthorized(UnauthorizedException unauthorizedException) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                                Map.of(
                                                "code", "401",
                                                "message", unauthorizedException.getMessage(),
                                                "status", "UNAUTHORIZED"));
        }

        @ExceptionHandler(ExistException.class)
        public ResponseEntity<?> handleExist(ExistException existException) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(
                                Map.of(
                                                "code", "409",
                                                "message", existException.getMessage(),
                                                "status", "CONFLICT"));
        }

        @ExceptionHandler(VerificationException.class)
        public ResponseEntity<?> handleToken(VerificationException verificationException) {
                return ResponseEntity.status(HttpStatus.GONE).body(
                                Map.of(
                                                "Code", "410",
                                                "message", verificationException.getMessage(),
                                                "status", "GONE"));
        }

        @ExceptionHandler(BadRequestException.class)
        public ResponseEntity<?> handle(BadRequestException badRequestException) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                                Map.of(
                                                "code", "400",
                                                "message", badRequestException.getMessage(),
                                                "status", "BAD_REQUEST"));
        }

        @ExceptionHandler(RateLimitException.class)
        public ResponseEntity<?> handle(RateLimitException exception) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(
                                Map.of(
                                                "code", "429",
                                                "message", exception.getMessage(),
                                                "status", "TOO_MANY_REQUEST"));
        }

        @ExceptionHandler(RoleException.class)
        public ResponseEntity<?> handle(RoleException exception) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                                Map.of(
                                                "code", "403",
                                                "message:", exception.getMessage(),
                                                "Status:", "FORBIDDEN"

                                ));
        }

        @ExceptionHandler(NumberFormatErrorException.class)
        public ResponseEntity<?> handle(NumberFormatErrorException exception) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                                Map.of(
                                                "code", "400",
                                                "message", exception.getMessage(),
                                                "status", "BAD_REQUEST"

                                ));
        }

        @ExceptionHandler(MethodArgumentNotValidException.class)
        public ResponseEntity<?> handleValidationException(MethodArgumentNotValidException exception) {
                Map<String, String> errors = new HashMap<>();

                exception.getBindingResult().getAllErrors().forEach((error) -> {
                        String fieldName = ((FieldError) error).getField();
                        if (fieldName.contains(".")) {
                                fieldName = fieldName.substring(fieldName.lastIndexOf(".") + 1);
                        }

                        String errorMessage = error.getDefaultMessage();
                        errors.put(fieldName, errorMessage);
                });

                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                                Map.of(
                                                "code", "400",
                                                "message", "Dữ liệu đầu vào không hợp lệ",
                                                "status", "BAD_REQUEST",
                                                "errors", errors));
        }

        @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
        public ResponseEntity<?> handleHttpMessageNotReadableException(
                        org.springframework.http.converter.HttpMessageNotReadableException exception) {
                String detailedMessage = "Định dạng dữ liệu JSON gửi lên không hợp lệ hoặc sai kiểu dữ liệu";

                // Nếu muốn lấy thông báo chi tiết hơn từ Spring (tiện cho việc debug xem sai ở
                // trường nào)
                if (exception.getCause() != null) {
                        detailedMessage = exception.getCause().getMessage();

                        // Cắt chuỗi để thông báo ngắn gọn, dễ nhìn hơn nếu muốn
                        if (detailedMessage.contains("Cannot deserialize value of type")) {
                                detailedMessage = "Dữ liệu truyền vào sai kiểu cấu trúc hệ thống yêu cầu.";
                        }
                }

                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                                Map.of(
                                                "code", "400",
                                                "message", detailedMessage,
                                                "status", "BAD_REQUEST"));
        }

        @ExceptionHandler(Exception.class)
        public ResponseEntity<?> handleAllExceptions(Exception ex) {
                String exceptionClassName = ex.getClass().getName();

                // Kiểm tra xem lỗi bắn ra có phải lỗi "Không tìm thấy tài nguyên" của cả 2 môi
                // trường không
                if ("org.springframework.web.reactive.resource.NoResourceFoundException".equals(exceptionClassName)
                                || "org.springframework.web.servlet.resource.NoResourceFoundException"
                                                .equals(exceptionClassName)) {

                        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                        .body("Không tìm thấy tài nguyên yêu cầu (404 Not Found)");
                }

                // Xử lý các exception khác của bạn ở đây...
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                .body("Lỗi hệ thống: " + ex.getMessage());
        }

        @ExceptionHandler(FeignException.class)
        public ResponseEntity<Map<String, Object>> handleFeignException(FeignException ex) {
                String message = "Lỗi khi gọi service nội bộ";
                try {
                        // FeignException cung cấp hàm contentUTF8() chứa nội dung chuỗi JSON thô
                        String content = ex.contentUTF8();
                        ObjectMapper mapper = new ObjectMapper();
                        Map<String, Object> map = mapper.readValue(content, Map.class);

                        if (map.containsKey("message")) {
                                message = (String) map.get("message");
                        }
                } catch (Exception e) {
                        // Nếu không parse được JSON thì lấy tạm message mặc định của Feign
                        message = ex.getMessage();
                }

                // Trả về JSON ngắn gọn, sạch đẹp cho Frontend
                return ResponseEntity.status(ex.status())
                                .body(Map.of(
                                                "status", ex.status(),
                                                "error", "Internal Service Error",
                                                "message", message));
        }

        @ExceptionHandler(RuntimeException.class)
        public ResponseEntity<Map<String, Object>> handleRuntimeException(RuntimeException ex) {
                Map<String, Object> errors = new HashMap<>();
                errors.put("status", HttpStatus.BAD_REQUEST.value());
                errors.put("message", ex.getMessage()); // Chỉ trả ra câu: "Cấu trúc thông tin ghế đặt..."
                errors.put("timestamp", System.currentTimeMillis());

                // Trả về HTTP Status 400 thay vì để lỗi 500 Internal Server Error
                return new ResponseEntity<>(errors, HttpStatus.BAD_REQUEST);
        }
}
