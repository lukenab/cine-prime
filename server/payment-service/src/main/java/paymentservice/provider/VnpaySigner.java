package paymentservice.provider;

import org.springframework.stereotype.Component;
import paymentservice.config.VnpayProperties;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class VnpaySigner {
    private final VnpayProperties properties;

    public VnpaySigner(VnpayProperties properties) {
        this.properties = properties;
    }

    public String buildPaymentUrl(Map<String, String> parameters) {
        String canonical = canonical(parameters);
        return properties.paymentUrl() + "?" + canonical
                + "&vnp_SecureHash=" + hmacSha512(canonical);
    }

    public boolean valid(Map<String, String> parameters) {
        String supplied = parameters.get("vnp_SecureHash");
        if (supplied == null || supplied.isBlank()) {
            return false;
        }
        byte[] expected = HexFormat.of().parseHex(hmacSha512(canonical(parameters)));
        try {
            byte[] actual = HexFormat.of().parseHex(supplied);
            return MessageDigest.isEqual(expected, actual);
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    String canonical(Map<String, String> parameters) {
        return parameters.entrySet().stream()
                .filter(entry -> entry.getValue() != null && !entry.getValue().isBlank())
                .filter(entry -> !entry.getKey().equals("vnp_SecureHash"))
                .filter(entry -> !entry.getKey().equals("vnp_SecureHashType"))
                .sorted(Comparator.comparing(Map.Entry::getKey))
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .collect(Collectors.joining("&"));
    }

    private String hmacSha512(String value) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA512");
            hmac.init(new SecretKeySpec(
                    properties.hashSecret().getBytes(StandardCharsets.UTF_8),
                    "HmacSHA512"));
            return HexFormat.of().formatHex(
                    hmac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot sign the VNPAY request.", exception);
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
