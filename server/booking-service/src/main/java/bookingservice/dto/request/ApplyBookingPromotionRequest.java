package bookingservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ApplyBookingPromotionRequest(
        @NotBlank @Size(max = 64) String promotionCode) {
}
