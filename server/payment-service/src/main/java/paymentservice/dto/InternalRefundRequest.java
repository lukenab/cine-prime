package paymentservice.dto;

import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InternalRefundRequest {
    @NotBlank
    @Size(max = 50)
    private String bookingId;

    @NotBlank
    @Size(max = 100)
    private String paymentReference;

    @NotNull
    @DecimalMin(value = "0.01")
    private BigDecimal amount;

    @NotBlank
    @Size(min = 3, max = 3)
    private String currency;

    @NotBlank
    @Size(max = 100)
    private String reasonCode;

    @Size(max = 500)
    private String reason;

    @NotBlank
    @Size(max = 120)
    private String idempotencyKey;
}
