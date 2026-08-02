package paymentservice.provider;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import paymentservice.entity.PaymentAttempt;
import paymentservice.entity.PaymentRefund;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class VnpayRefundGatewayTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private VnpayRefundSigner signer;
    private VnpayRefundGateway gateway;
    private MockRestServiceServer server;

    @BeforeEach
    void setUp() {
        var properties = VnpayRefundTestFixtures.properties();
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        signer = new VnpayRefundSigner(properties);
        gateway = new VnpayRefundGateway(builder, properties, signer);
    }

    @Test
    void submitsSignedPartialRefundAndAcceptsVerifiedSuccess() throws Exception {
        Map<String, String> response = signed(VnpayRefundTestFixtures.successResponse());
        server.expect(requestTo(VnpayRefundTestFixtures.properties().apiUrl()))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.vnp_Command").value("refund"))
                .andExpect(jsonPath("$.vnp_TransactionType").value("03"))
                .andExpect(jsonPath("$.vnp_Amount").value("5000000"))
                .andExpect(jsonPath("$.vnp_SecureHash").isNotEmpty())
                .andRespond(withSuccess(objectMapper.writeValueAsString(response), MediaType.APPLICATION_JSON));

        ProviderRefundResult result = gateway.submit(payment(), refund());

        assertThat(result.outcome()).isEqualTo(ProviderRefundResult.Outcome.SUCCEEDED);
        assertThat(result.providerReference()).isEqualTo("response123");
        server.verify();
    }

    @Test
    void mapsVerifiedProviderRejectionToFailed() throws Exception {
        Map<String, String> response = new LinkedHashMap<>(VnpayRefundTestFixtures.successResponse());
        response.put("vnp_ResponseCode", "95");
        response.put("vnp_TransactionStatus", "09");
        response.put("vnp_Message", "Refund rejected");
        response = signed(response);
        server.expect(requestTo(VnpayRefundTestFixtures.properties().apiUrl()))
                .andRespond(withSuccess(objectMapper.writeValueAsString(response), MediaType.APPLICATION_JSON));

        ProviderRefundResult result = gateway.submit(payment(), refund());

        assertThat(result.outcome()).isEqualTo(ProviderRefundResult.Outcome.FAILED);
        assertThat(result.responseCode()).isEqualTo("95");
    }

    @Test
    void doesNotTrustResponseWithInvalidSignature() throws Exception {
        Map<String, String> response = new LinkedHashMap<>(VnpayRefundTestFixtures.successResponse());
        response.put("vnp_SecureHash", "00".repeat(64));
        server.expect(requestTo(VnpayRefundTestFixtures.properties().apiUrl()))
                .andRespond(withSuccess(objectMapper.writeValueAsString(response), MediaType.APPLICATION_JSON));

        ProviderRefundResult result = gateway.submit(payment(), refund());

        assertThat(result.outcome()).isEqualTo(ProviderRefundResult.Outcome.UNKNOWN);
        assertThat(result.responseCode()).isEqualTo("INVALID_SIGNATURE");
    }

    private Map<String, String> signed(Map<String, String> response) {
        Map<String, String> signed = new LinkedHashMap<>(response);
        signed.put("vnp_SecureHash", signer.signResponse(signed));
        return signed;
    }

    private PaymentAttempt payment() {
        return PaymentAttempt.builder()
                .paymentId("PAY-1")
                .bookingId("BKG1")
                .providerTxnRef("CP123")
                .providerTransactionId("123456")
                .providerCreatedAt(OffsetDateTime.parse("2026-08-02T12:00:00+07:00"))
                .amount(new BigDecimal("100000.00"))
                .build();
    }

    private PaymentRefund refund() {
        return PaymentRefund.builder()
                .bookingId("BKG1")
                .idempotencyKey("refund-key-1")
                .amount(new BigDecimal("50000.00"))
                .build();
    }
}
