package bookingservice.dto.request;

import lombok.Data;
import java.util.List;

@Data
public class BookingPayload {
    private Long showtimeId;
    private List<Long> seatIds;
}
