package paymentservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "payment.vnpay")
public record VnpayProperties(
        String paymentUrl,
        String apiUrl,
        String returnUrl,
        String tmnCode,
        String hashSecret,
        String version,
        String locale,
        String timezone,
        String refundCreateBy,
        String refundIpAddress) {

    public boolean configured() {
        return notBlank(paymentUrl)
                && notBlank(returnUrl)
                && notBlank(tmnCode)
                && notBlank(hashSecret);
    }

    public boolean refundConfigured() {
        return notBlank(apiUrl)
                && notBlank(tmnCode)
                && notBlank(hashSecret)
                && notBlank(version)
                && notBlank(refundCreateBy)
                && notBlank(refundIpAddress);
    }

    private boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
