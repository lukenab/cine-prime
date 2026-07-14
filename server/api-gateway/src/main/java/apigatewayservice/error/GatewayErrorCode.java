package apigatewayservice.error;

import org.springframework.http.HttpStatus;

public enum GatewayErrorCode {
    SERVICE_UNAVAILABLE(5003, "Service temporarily unavailable", HttpStatus.SERVICE_UNAVAILABLE),
    GATEWAY_TIMEOUT(5004, "Downstream service timed out", HttpStatus.GATEWAY_TIMEOUT),
    ROUTE_NOT_FOUND(5005, "Gateway route not found", HttpStatus.NOT_FOUND),
    INTERNAL_GATEWAY_ERROR(5006, "Gateway could not process the request", HttpStatus.INTERNAL_SERVER_ERROR),
    GATEWAY_REQUEST_REJECTED(5007, "Gateway request rejected", HttpStatus.BAD_REQUEST);

    private final int code;
    private final String message;
    private final HttpStatus status;

    GatewayErrorCode(int code, String message, HttpStatus status) {
        this.code = code;
        this.message = message;
        this.status = status;
    }

    public int getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
