package paymentservice.provider;

public record ProviderRefundResult(
        Outcome outcome,
        String providerReference,
        String responseCode,
        String message) {

    public enum Outcome {
        SUCCEEDED,
        PENDING,
        FAILED,
        UNKNOWN
    }
}
