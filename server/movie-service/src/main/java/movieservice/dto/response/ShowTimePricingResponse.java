package movieservice.dto.response;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShowTimePricingResponse {

    Long showTimeId;

    LocalDate showDate;

    LocalTime startTime;

    LocalTime endTime;

    OffsetDateTime startAt;

    OffsetDateTime endAt;

    Long movieId;

    String movieName;

    Long cinemaRoomId;

    String cinemaRoomName;

    String status;

    LocalDateTime updatedAt;

    /** Giá vé tổng quát cho suất chiếu — null nếu dùng giá ghế mặc định. */
    BigDecimal basePrice;
}
