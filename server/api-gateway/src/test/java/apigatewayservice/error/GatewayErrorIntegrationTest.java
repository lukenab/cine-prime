package apigatewayservice.error;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.Set;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.EntityExchangeResult;
import org.springframework.test.web.reactive.server.WebTestClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import reactor.core.publisher.Mono;
import reactor.netty.DisposableServer;
import reactor.netty.http.server.HttpServer;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "eureka.client.enabled=false")
@Import(GatewayErrorIntegrationTest.PassthroughRouteConfiguration.class)
class GatewayErrorIntegrationTest {

    private static final String STANDARD_DOMAIN_ERROR =
            "{\"code\":2012,\"message\":\"Seat not found.\",\"result\":null}";
    private static final DisposableServer DOWNSTREAM = HttpServer.create()
            .host("127.0.0.1")
            .port(0)
            .route(routes -> routes
                    .get("/__test/passthrough/success", (request, response) -> response
                            .status(HttpStatus.OK.value())
                            .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                            .sendString(Mono.just("{\"code\":1000,\"result\":\"ok\"}")))
                    .get("/__test/passthrough/domain-error", (request, response) -> response
                            .status(HttpStatus.NOT_FOUND.value())
                            .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                            .sendString(Mono.just(STANDARD_DOMAIN_ERROR))))
            .bindNow();

    @LocalServerPort
    private int gatewayPort;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RouteLocator routeLocator;

    private WebTestClient webTestClient;

    @BeforeEach
    void setUp() {
        webTestClient = WebTestClient.bindToServer()
                .baseUrl("http://127.0.0.1:" + gatewayPort)
                .responseTimeout(Duration.ofSeconds(5))
                .build();
    }

    @AfterAll
    static void stopDownstream() {
        DOWNSTREAM.disposeNow();
    }

    @Test
    void standardizesUnavailableServiceError() throws Exception {
        EntityExchangeResult<byte[]> result = webTestClient.get()
                .uri("/api/bookings/__missing_service__")
                .exchange()
                .expectStatus().isEqualTo(HttpStatus.SERVICE_UNAVAILABLE)
                .expectHeader().contentType(MediaType.APPLICATION_JSON)
                .expectHeader().exists(GatewayErrorWebExceptionHandler.REQUEST_ID_HEADER)
                .expectBody()
                .returnResult();

        JsonNode response = objectMapper.readTree(result.getResponseBody());
        assertEquals(5003, response.get("code").asInt());
        assertEquals("Service temporarily unavailable", response.get("message").asText());
        assertTrue(response.has("result") && response.get("result").isNull());
    }

    @Test
    void standardizesUnknownRouteError() throws Exception {
        EntityExchangeResult<byte[]> result = webTestClient.get()
                .uri("/__gateway_missing_route__")
                .exchange()
                .expectStatus().isNotFound()
                .expectHeader().contentType(MediaType.APPLICATION_JSON)
                .expectBody()
                .returnResult();

        JsonNode response = objectMapper.readTree(result.getResponseBody());
        assertEquals(5005, response.get("code").asInt());
        assertEquals("Gateway route not found", response.get("message").asText());
    }

    @Test
    void keepsExistingServiceRoutesRegistered() {
        Set<String> routeIds = routeLocator.getRoutes()
                .map(route -> route.getId())
                .collectList()
                .map(Set::copyOf)
                .block();

        assertTrue(routeIds != null && routeIds.containsAll(Set.of(
                "auth-service", "user-service", "movie-service", "booking-service")));
    }

    @Test
    void preservesSuccessfulDownstreamResponse() {
        webTestClient.get()
                .uri("/__test/passthrough/success")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .json("{\"code\":1000,\"result\":\"ok\"}");
    }

    @Test
    void preservesStandardDownstreamErrorResponse() {
        webTestClient.get()
                .uri("/__test/passthrough/domain-error")
                .exchange()
                .expectStatus().isNotFound()
                .expectBody()
                .json(STANDARD_DOMAIN_ERROR);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class PassthroughRouteConfiguration {

        @Bean
        RouteLocator passthroughRouteLocator(RouteLocatorBuilder builder) {
            return builder.routes()
                    .route("test-passthrough", route -> route.path("/__test/passthrough/**")
                            .uri("http://127.0.0.1:" + DOWNSTREAM.port()))
                    .build();
        }
    }
}
