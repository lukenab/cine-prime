package bookingservice.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class BookingConfirmation {
    private String bookingId;
    private LocalDateTime lockedUntil;
}
