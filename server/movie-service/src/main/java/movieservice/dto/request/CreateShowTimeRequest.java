package movieservice.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
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
    @DecimalMin(value = "0.01", message = "Base price must be greater than 0")
    @Digits(integer = 8, fraction = 2,
            message = "Base price must have at most 8 integer digits and 2 decimal places")
    BigDecimal basePrice;
}
