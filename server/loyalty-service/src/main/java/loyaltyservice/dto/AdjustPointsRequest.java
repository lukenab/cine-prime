package loyaltyservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AdjustPointsRequest(
        @NotNull Integer points,
        @NotBlank @Size(max = 250) String reason,
        @NotBlank @Size(max = 150) String idempotencyKey) {
}
