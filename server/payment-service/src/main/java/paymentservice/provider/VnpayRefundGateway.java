package paymentservice.provider;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import paymentservice.config.VnpayProperties;
import paymentservice.entity.PaymentAttempt;
import paymentservice.entity.PaymentRefund;
import paymentservice.util.PaymentHashing;

import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import static paymentservice.provider.ProviderRefundResult.Outcome.*;

@Component
public class VnpayRefundGateway implements ProviderRefundGateway {
    private static final DateTimeFormatter VNPAY_TIME =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final RestClient client;
    private final VnpayProperties properties;
    private final VnpayRefundSigner signer;

    public VnpayRefundGateway(
            RestClient.Builder builder,
            VnpayProperties properties,
            VnpayRefundSigner signer) {
        this.client = builder.build();
        this.properties = properties;
        this.signer = signer;
    }

    @Override
    public ProviderRefundResult submit(PaymentAttempt payment, PaymentRefund refund) {
        if (!properties.refundConfigured()) {
            return new ProviderRefundResult(
                    UNKNOWN, null, "NOT_CONFIGURED", "VNPAY refund API is not configured.");
        }
        Map<String, String> request = request(payment, refund, OffsetDateTime.now());
        try {
            Map<String, String> response = client.post()
                    .uri(properties.apiUrl())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });
            return interpret(payment, refund, response);
        } catch (RestClientException exception) {
            return new ProviderRefundResult(
                    UNKNOWN, null, "HTTP_ERROR", safeMessage(exception));
        }
    }

    Map<String, String> request(
            PaymentAttempt payment,
            PaymentRefund refund,
            OffsetDateTime now) {
        ZoneId zone = ZoneId.of(properties.timezone());
        OffsetDateTime originalCreatedAt = Objects.requireNonNullElse(
                payment.getProviderCreatedAt(), payment.getCreatedAt());
        String amount = refund.getAmount().movePointRight(2)
                .setScale(0, RoundingMode.UNNECESSARY).toPlainString();
        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("vnp_RequestId", requestId(refund.getIdempotencyKey()));
        parameters.put("vnp_Version", properties.version());
        parameters.put("vnp_Command", "refund");
        parameters.put("vnp_TmnCode", properties.tmnCode());
        parameters.put("vnp_TransactionType",
                refund.getAmount().compareTo(payment.getAmount()) == 0 ? "02" : "03");
        parameters.put("vnp_TxnRef", payment.getProviderTxnRef());
        parameters.put("vnp_Amount", amount);
        parameters.put("vnp_TransactionNo",
                Objects.toString(payment.getProviderTransactionId(), ""));
        parameters.put("vnp_TransactionDate",
                originalCreatedAt.atZoneSameInstant(zone).format(VNPAY_TIME));
        parameters.put("vnp_CreateBy", properties.refundCreateBy());
        parameters.put("vnp_CreateDate", now.atZoneSameInstant(zone).format(VNPAY_TIME));
        parameters.put("vnp_IpAddr", properties.refundIpAddress());
        parameters.put("vnp_OrderInfo", "Refund booking " + refund.getBookingId());
        parameters.put("vnp_SecureHash", signer.signRequest(parameters));
        return parameters;
    }

    private ProviderRefundResult interpret(
            PaymentAttempt payment,
            PaymentRefund refund,
            Map<String, String> response) {
        if (response == null || !signer.validResponse(response)) {
            return new ProviderRefundResult(
                    UNKNOWN, null, "INVALID_SIGNATURE", "Invalid VNPAY refund response signature.");
        }
        String expectedAmount = refund.getAmount().movePointRight(2)
                .setScale(0, RoundingMode.UNNECESSARY).toPlainString();
        if (!Objects.equals("refund", response.get("vnp_Command"))
                || !Objects.equals(properties.tmnCode(), response.get("vnp_TmnCode"))
                || !Objects.equals(payment.getProviderTxnRef(), response.get("vnp_TxnRef"))
                || !Objects.equals(expectedAmount, response.get("vnp_Amount"))) {
            return new ProviderRefundResult(
                    UNKNOWN, null, "RESPONSE_MISMATCH", "VNPAY response does not match the refund request.");
        }

        String responseCode = response.get("vnp_ResponseCode");
        String transactionStatus = response.get("vnp_TransactionStatus");
        String providerReference = firstNonBlank(
                response.get("vnp_ResponseId"), response.get("vnp_TransactionNo"));
        String message = Objects.toString(response.get("vnp_Message"), "VNPAY refund response");
        if ("00".equals(responseCode) && "00".equals(transactionStatus)) {
            return new ProviderRefundResult(SUCCEEDED, providerReference, responseCode, message);
        }
        if (("00".equals(responseCode) && ("05".equals(transactionStatus)
                || "06".equals(transactionStatus))) || "94".equals(responseCode)) {
            return new ProviderRefundResult(PENDING, providerReference, responseCode, message);
        }
        return new ProviderRefundResult(FAILED, providerReference, responseCode, message);
    }

    private String requestId(String idempotencyKey) {
        return PaymentHashing.sha256(idempotencyKey).substring(0, 32);
    }

    private String firstNonBlank(String first, String second) {
        return first != null && !first.isBlank() ? first : second;
    }

    private String safeMessage(Exception exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank()
                ? exception.getClass().getSimpleName()
                : message.substring(0, Math.min(message.length(), 500));
    }
}
