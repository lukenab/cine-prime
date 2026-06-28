package bookingservice.dto.response;


import lombok.*;
import lombok.experimental.FieldDefaults;
import java.util.List;

import bookingservice.entity.SeatLock;
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SeatHoldResponse {
     List<SeatLock> lockedSeats;
}
