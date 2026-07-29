package bookingservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CancelBookingRequest {
    @NotBlank
    private String reasonCode;
    @Size(max = 500)
    private String reason;
}
