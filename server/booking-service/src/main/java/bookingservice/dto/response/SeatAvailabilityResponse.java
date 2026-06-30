package bookingservice.dto.response;

import java.math.BigDecimal;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Data
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class SeatAvailabilityResponse {
    Long showtimeSeatId; // showtime_seat_id
    BigDecimal price;    // price
    String seatCode;     // seat_code
    String seatType;     // seat_type
    String status;       // status (AVAILABLE, LOCKED, BOOKED)
    Long seatId;         // seat_id
    Long showtimeId;     // showtime_id
}
