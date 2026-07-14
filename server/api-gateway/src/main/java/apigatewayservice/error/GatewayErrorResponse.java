package apigatewayservice.error;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record GatewayErrorResponse(int code, String message, Object result) {

    public static GatewayErrorResponse from(GatewayErrorCode errorCode) {
        return new GatewayErrorResponse(errorCode.getCode(), errorCode.getMessage(), null);
    }
}
