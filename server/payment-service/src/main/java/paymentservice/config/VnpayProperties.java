package paymentservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "payment.vnpay")
public record VnpayProperties(
        String paymentUrl,
        String returnUrl,
        String tmnCode,
        String hashSecret,
        String version,
        String locale,
        String timezone) {

    public boolean configured() {
        return notBlank(paymentUrl)
                && notBlank(returnUrl)
                && notBlank(tmnCode)
                && notBlank(hashSecret);
    }

    private boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
