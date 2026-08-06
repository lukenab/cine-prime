package paymentservice.provider;

import org.springframework.stereotype.Component;
import paymentservice.config.VnpayProperties;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
public class VnpayRefundSigner {
    private static final List<String> REQUEST_FIELDS = List.of(
            "vnp_RequestId", "vnp_Version", "vnp_Command", "vnp_TmnCode",
            "vnp_TransactionType", "vnp_TxnRef", "vnp_Amount", "vnp_TransactionNo",
            "vnp_TransactionDate", "vnp_CreateBy", "vnp_CreateDate", "vnp_IpAddr",
            "vnp_OrderInfo");
    private static final List<String> RESPONSE_FIELDS = List.of(
            "vnp_ResponseId", "vnp_Command", "vnp_ResponseCode", "vnp_Message",
            "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate",
            "vnp_TransactionNo", "vnp_TransactionType", "vnp_TransactionStatus",
            "vnp_OrderInfo");

    private final VnpayProperties properties;

    public VnpayRefundSigner(VnpayProperties properties) {
        this.properties = properties;
    }

    public String signRequest(Map<String, String> parameters) {
        return hmac(canonical(parameters, REQUEST_FIELDS));
    }

    public boolean validResponse(Map<String, String> parameters) {
        String supplied = parameters.get("vnp_SecureHash");
        if (supplied == null || supplied.isBlank()) {
            return false;
        }
        try {
            return MessageDigest.isEqual(
                    HexFormat.of().parseHex(hmac(canonical(parameters, RESPONSE_FIELDS))),
                    HexFormat.of().parseHex(supplied));
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    String canonicalRequest(Map<String, String> parameters) {
        return canonical(parameters, REQUEST_FIELDS);
    }

    String canonicalResponse(Map<String, String> parameters) {
        return canonical(parameters, RESPONSE_FIELDS);
    }

    String signResponse(Map<String, String> parameters) {
        return hmac(canonical(parameters, RESPONSE_FIELDS));
    }

    private String canonical(Map<String, String> parameters, List<String> fields) {
        return fields.stream()
                .map(field -> Objects.toString(parameters.get(field), ""))
                .reduce((left, right) -> left + "|" + right)
                .orElse("");
    }

    private String hmac(String value) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA512");
            hmac.init(new SecretKeySpec(
                    properties.hashSecret().getBytes(StandardCharsets.UTF_8),
                    "HmacSHA512"));
            return HexFormat.of().formatHex(
                    hmac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot sign the VNPAY refund message.", exception);
        }
    }
}
