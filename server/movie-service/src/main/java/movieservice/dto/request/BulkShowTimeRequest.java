package movieservice.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
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
    Long movieId;

    @NotEmpty(message = "At least one cinema room ID is required")
    List<Long> cinemaRoomIds;

    @NotNull(message = "From date cannot be null")
    LocalDate fromDate;

    @NotNull(message = "To date cannot be null")
    LocalDate toDate;

    @NotEmpty(message = "At least one start time is required")
    List<LocalTime> startTimes;

    /** Base ticket price applied to all generated showtimes */
    BigDecimal basePrice;

    /** Audio language code — defaults to "vi" if omitted */
    String languageCode;

    /** Subtitle language code — null means no subtitles */
    String subtitleCode;
}
