package bookingservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Data
public class PaymentOutcomeRequest {
    @NotBlank
    private String source;
    @NotBlank
    private String eventId;
    @NotBlank
    private String eventType;
    @NotBlank
    private String bookingId;
    @NotBlank
    private String paymentReference;
    @NotNull
    private BigDecimal amount;
    @NotBlank
    private String currency;
    private OffsetDateTime occurredAt;
}
