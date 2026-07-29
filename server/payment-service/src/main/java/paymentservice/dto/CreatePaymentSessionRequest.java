package paymentservice.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreatePaymentSessionRequest {
    @NotBlank
    private String bookingId;
}
