package bookingservice.service;

import bookingservice.client.MovieInventoryClient;
import bookingservice.client.ConcessionClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import movie.theater.common.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class PaymentWebhookServiceTest {
    private MovieInventoryClient movieInventoryClient;
    private PaymentProcessingStateService stateService;
    private ConcessionClient concessionClient;
    private PaymentWebhookService service;

    @BeforeEach
    void setUp() {
        movieInventoryClient = mock(MovieInventoryClient.class);
        stateService = mock(PaymentProcessingStateService.class);
        concessionClient = mock(ConcessionClient.class);
        service = new PaymentWebhookService(
                new ObjectMapper(),
                movieInventoryClient,
                stateService,
                concessionClient);
        ReflectionTestUtils.setField(
                service,
                "webhookSecret",
                "payment-webhook-test-secret");
        ReflectionTestUtils.setField(
                service,
                "movieServiceInternalKey",
                "movie-internal-test-key");
    }

    @Test
    void shouldRejectWebhookWithInvalidSignatureBeforeChangingState() {
        String payload = """
                {
                  "source": "payment-service",
                  "eventId": "evt-1",
                  "eventType": "PAYMENT_SUCCEEDED",
                  "bookingId": "booking-1",
                  "paymentReference": "payment-1",
                  "amount": 90000,
                  "currency": "VND"
                }
                """;

        assertThatThrownBy(() -> service.process(payload, "invalid-signature"))
                .isInstanceOf(AppException.class);
        verifyNoInteractions(stateService, movieInventoryClient, concessionClient);
    }
}
