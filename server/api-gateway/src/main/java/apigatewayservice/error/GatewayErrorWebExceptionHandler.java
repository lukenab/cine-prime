package apigatewayservice.error;

import java.net.ConnectException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeoutException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.reactive.error.ErrorWebExceptionHandler;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.netty.channel.ConnectTimeoutException;
import io.netty.handler.timeout.ReadTimeoutException;
import reactor.core.publisher.Mono;

@Component
@Order(-2)
public class GatewayErrorWebExceptionHandler implements ErrorWebExceptionHandler {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";

    private static final Logger log = LoggerFactory.getLogger(GatewayErrorWebExceptionHandler.class);
    private static final int MAX_CAUSE_DEPTH = 20;
    private static final byte[] SERIALIZATION_FALLBACK = ("{\"code\":5006,"
            + "\"message\":\"Gateway could not process the request\",\"result\":null}")
            .getBytes(StandardCharsets.UTF_8);

    private final ObjectMapper objectMapper;

    public GatewayErrorWebExceptionHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable throwable) {
        ServerHttpResponse response = exchange.getResponse();
        if (response.isCommitted()) {
            return Mono.error(throwable);
        }

        ResolvedGatewayError resolvedError = resolveError(throwable);
        GatewayErrorCode errorCode = resolvedError.errorCode();
        String requestId = exchange.getRequest().getId();

        response.setStatusCode(resolvedError.statusCode());
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        response.getHeaders().set(REQUEST_ID_HEADER, requestId);

        logFailure(exchange, throwable, errorCode, requestId);

        DataBuffer buffer = response.bufferFactory().wrap(serialize(errorCode));
        return response.writeWith(Mono.just(buffer));
    }

    ResolvedGatewayError resolveError(Throwable throwable) {
        if (hasCause(throwable, org.springframework.cloud.gateway.support.TimeoutException.class)
                || hasCause(throwable, TimeoutException.class)
                || hasCause(throwable, ReadTimeoutException.class)
                || hasCause(throwable, ConnectTimeoutException.class)) {
            return resolved(GatewayErrorCode.GATEWAY_TIMEOUT);
        }

        if (hasCause(throwable, ConnectException.class)
                || hasCause(throwable, UnknownHostException.class)) {
            return resolved(GatewayErrorCode.SERVICE_UNAVAILABLE);
        }

        ResponseStatusException statusException = findCause(throwable, ResponseStatusException.class);
        if (statusException != null) {
            HttpStatusCode statusCode = statusException.getStatusCode();
            return switch (statusCode.value()) {
                case 404 -> resolved(GatewayErrorCode.ROUTE_NOT_FOUND);
                case 503 -> resolved(GatewayErrorCode.SERVICE_UNAVAILABLE);
                case 504 -> resolved(GatewayErrorCode.GATEWAY_TIMEOUT);
                default -> new ResolvedGatewayError(
                        statusCode.is4xxClientError()
                                ? GatewayErrorCode.GATEWAY_REQUEST_REJECTED
                                : GatewayErrorCode.INTERNAL_GATEWAY_ERROR,
                        statusCode);
            };
        }

        return resolved(GatewayErrorCode.INTERNAL_GATEWAY_ERROR);
    }

    private ResolvedGatewayError resolved(GatewayErrorCode errorCode) {
        return new ResolvedGatewayError(errorCode, errorCode.getStatus());
    }

    private byte[] serialize(GatewayErrorCode errorCode) {
        try {
            return objectMapper.writeValueAsBytes(GatewayErrorResponse.from(errorCode));
        } catch (JsonProcessingException exception) {
            log.error("Unable to serialize gateway error response", exception);
            return SERIALIZATION_FALLBACK;
        }
    }

    private void logFailure(ServerWebExchange exchange, Throwable throwable,
                            GatewayErrorCode errorCode, String requestId) {
        String path = exchange.getRequest().getURI().getPath();
        if (errorCode == GatewayErrorCode.INTERNAL_GATEWAY_ERROR) {
            log.error("Gateway request failed: requestId={}, method={}, path={}, code={}",
                    requestId, exchange.getRequest().getMethod(), path, errorCode.getCode(), throwable);
            return;
        }

        log.warn("Gateway request failed: requestId={}, method={}, path={}, code={}, cause={}",
                requestId, exchange.getRequest().getMethod(), path, errorCode.getCode(),
                throwable.getClass().getSimpleName());
    }

    private boolean hasCause(Throwable throwable, Class<? extends Throwable> causeType) {
        return findCause(throwable, causeType) != null;
    }

    private <T extends Throwable> T findCause(Throwable throwable, Class<T> causeType) {
        Throwable current = throwable;
        int depth = 0;
        while (current != null && depth++ < MAX_CAUSE_DEPTH) {
            if (causeType.isInstance(current)) {
                return causeType.cast(current);
            }
            current = current.getCause();
        }
        return null;
    }

    record ResolvedGatewayError(GatewayErrorCode errorCode, HttpStatusCode statusCode) {
    }
}
