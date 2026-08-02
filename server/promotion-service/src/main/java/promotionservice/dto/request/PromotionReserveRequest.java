package promotionservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

public record PromotionReserveRequest(@NotBlank String idempotencyKey, @Valid PromotionQuoteRequest snapshot) {}
