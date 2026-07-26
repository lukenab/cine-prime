package bookingservice.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@Builder
public class BookingConfirmation {
    private String bookingId;
    private OffsetDateTime lockedUntil;
}
