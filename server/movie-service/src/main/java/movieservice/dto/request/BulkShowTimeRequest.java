package movieservice.dto.request;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BulkShowTimeRequest {

    @NotNull(message = "Movie ID cannot be null")
    @Positive(message = "Movie ID must be greater than 0")
    Long movieId;

    @NotEmpty(message = "At least one cinema room ID is required")
    @Size(max = 20, message = "At most 20 cinema rooms are allowed")
    List<@NotNull(message = "Cinema room ID cannot be null")
         @Positive(message = "Cinema room ID must be greater than 0") Long> cinemaRoomIds;

    @NotNull(message = "From date cannot be null")
    LocalDate fromDate;

    @NotNull(message = "To date cannot be null")
    LocalDate toDate;

    @NotEmpty(message = "At least one start time is required")
    @Size(max = 20, message = "At most 20 start times are allowed")
    List<@NotNull(message = "Start time cannot be null") LocalTime> startTimes;

    @NotNull(message = "Base price cannot be null")
    @Positive(message = "Base price must be greater than 0")
    @Digits(integer = 8, fraction = 2,
            message = "Base price must fit DECIMAL(10,2)")
    BigDecimal basePrice;

    /** Audio language code — defaults to "vi" if omitted */
    String languageCode;

    /** Subtitle language code — null means no subtitles */
    String subtitleCode;
}
