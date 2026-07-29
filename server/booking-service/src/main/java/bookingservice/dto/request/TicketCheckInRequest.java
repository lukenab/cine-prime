package bookingservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TicketCheckInRequest {
    @NotBlank
    private String passToken;

    @NotBlank
    private String gateCode;

    private String deviceId;
    private String checkInMode = "SCAN";
}
