package movieservice.dto.response;

import java.math.BigDecimal;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SeatResponse {
    Long seatId;
    String seatCode;
    String seatType;
    Integer seatStatus;
    BigDecimal price;
    Long cinemaRoomId;
    String cinemaRoomName;
}
