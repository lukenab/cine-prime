package apigatewayservice.error;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.support.NotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

class GatewayErrorWebExceptionHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final GatewayErrorWebExceptionHandler handler = new GatewayErrorWebExceptionHandler(objectMapper);

    @Test
    void returnsStandardResponseWhenServiceIsUnavailable() throws Exception {
        MockServerWebExchange exchange = handle(new NotFoundException("No booking-service instance available"));

        assertResponse(exchange, HttpStatus.SERVICE_UNAVAILABLE, GatewayErrorCode.SERVICE_UNAVAILABLE);
    }

    @Test
    void returnsGatewayTimeoutForDownstreamTimeout() throws Exception {
        MockServerWebExchange exchange = handle(
                new org.springframework.cloud.gateway.support.TimeoutException("booking-service timed out"));

        assertResponse(exchange, HttpStatus.GATEWAY_TIMEOUT, GatewayErrorCode.GATEWAY_TIMEOUT);
    }

    @Test
    void returnsNotFoundForUnknownGatewayRoute() throws Exception {
        MockServerWebExchange exchange = handle(new ResponseStatusException(HttpStatus.NOT_FOUND));

        assertResponse(exchange, HttpStatus.NOT_FOUND, GatewayErrorCode.ROUTE_NOT_FOUND);
    }

    @Test
    void hidesUnexpectedExceptionDetails() throws Exception {
        MockServerWebExchange exchange = handle(new IllegalStateException("sensitive internal detail"));

        assertResponse(exchange, HttpStatus.INTERNAL_SERVER_ERROR, GatewayErrorCode.INTERNAL_GATEWAY_ERROR);
        String body = exchange.getResponse().getBodyAsString().block();
        assertTrue(body != null && !body.contains("sensitive internal detail"));
    }

    @Test
    void preservesOtherGatewayClientErrorStatus() throws Exception {
        MockServerWebExchange exchange = handle(
                new ResponseStatusException(HttpStatus.METHOD_NOT_ALLOWED));

        assertResponse(exchange, HttpStatus.METHOD_NOT_ALLOWED,
                GatewayErrorCode.GATEWAY_REQUEST_REJECTED);
    }

    private MockServerWebExchange handle(Throwable throwable) {
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/bookings/test").build());
        handler.handle(exchange, throwable).block();
        return exchange;
    }

    private void assertResponse(MockServerWebExchange exchange, HttpStatus expectedStatus,
                                GatewayErrorCode expectedError) throws Exception {
        assertEquals(expectedStatus, exchange.getResponse().getStatusCode());
        assertTrue(exchange.getResponse().getHeaders().containsKey(
                GatewayErrorWebExceptionHandler.REQUEST_ID_HEADER));

        JsonNode response = objectMapper.readTree(exchange.getResponse().getBodyAsString().block());
        assertEquals(expectedError.getCode(), response.get("code").asInt());
        assertEquals(expectedError.getMessage(), response.get("message").asText());
        assertTrue(response.has("result"));
        assertTrue(response.get("result").isNull());
    }
}
