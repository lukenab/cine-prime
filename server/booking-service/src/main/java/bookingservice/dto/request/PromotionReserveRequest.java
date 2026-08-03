package bookingservice.dto.request;

/** Idempotency key rieng cho quota reservation cua promotion. */
public record PromotionReserveRequest(String idempotencyKey, PromotionQuoteRequest snapshot) {
}
