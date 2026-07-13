package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SeatResponse {
    Long seatId;
    String seatCode;
    String rowLabel;
    Integer colNumber;
    String seatType;
    Integer colSpan;
    String status;
    BigDecimal price;
    Long cinemaRoomId;
    String cinemaRoomName;
}
