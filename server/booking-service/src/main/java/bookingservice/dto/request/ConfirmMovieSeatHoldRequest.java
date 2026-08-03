package bookingservice.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ConfirmMovieSeatHoldRequest {
    private String bookingId;
}
