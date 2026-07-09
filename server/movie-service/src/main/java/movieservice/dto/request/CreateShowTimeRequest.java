package movieservice.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CreateShowTimeRequest {

    @NotNull(message = "Movie ID cannot be null")
    Long movieId;

    @NotNull(message = "Cinema room ID cannot be null")
    Long cinemaRoomId;

    @NotNull(message = "Show date cannot be null")
    LocalDate showDate;

    @NotNull(message = "Start time cannot be null")
    LocalTime startTime;

    /** Ngôn ngữ âm thanh — mặc định "vi" nếu không truyền */
    String languageCode;

    /** Ngôn ngữ phụ đề — null nếu không có */
    String subtitleCode;

    /** Optional — overrides default seat price when provided. */
    BigDecimal basePrice;
}
