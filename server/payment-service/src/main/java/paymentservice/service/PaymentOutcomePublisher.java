package paymentservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import paymentservice.dto.PaymentOutcomePayload;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

@Service
public class PaymentOutcomePublisher {
    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final String bookingServiceUrl;
    private final String webhookSecret;

    public PaymentOutcomePublisher(
            ObjectMapper objectMapper,
            RestClient.Builder builder,
            @Value("${booking-service.url}") String bookingServiceUrl,
            @Value("${booking-service.payment-webhook-secret}") String webhookSecret) {
        this.objectMapper = objectMapper;
        this.restClient = builder.build();
        this.bookingServiceUrl = bookingServiceUrl;
        this.webhookSecret = webhookSecret;
    }

    public String serialize(PaymentOutcomePayload payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot serialize payment outcome.", exception);
        }
    }

    public void publish(String rawPayload) {
        restClient.post()
                .uri(bookingServiceUrl + "/api/internal/payments/webhooks/outcome")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Webhook-Signature", "sha256=" + signature(rawPayload))
                .body(rawPayload)
                .retrieve()
                .toBodilessEntity();
    }

    private String signature(String payload) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(new SecretKeySpec(
                    webhookSecret.getBytes(StandardCharsets.UTF_8),
                    "HmacSHA256"));
            return HexFormat.of().formatHex(
                    hmac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot sign payment outcome.", exception);
        }
    }
}
