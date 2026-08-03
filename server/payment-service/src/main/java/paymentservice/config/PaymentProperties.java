package paymentservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "payment")
public record PaymentProperties(
        int sessionTtlMinutes,
        String frontendCheckoutUrl,
        String internalServiceKey,
        Delivery delivery,
        RateGuard rateGuard,
        Refund refund) {

    public Duration sessionTtl() {
        return Duration.ofMinutes(Math.max(sessionTtlMinutes, 1));
    }

    public record Delivery(long fixedDelayMs, int maxAttempts) {
    }

    public record RateGuard(int maxSessionsPerMinute) {
    }

    public record Refund(boolean sandboxAutoApprove) {
    }
}
