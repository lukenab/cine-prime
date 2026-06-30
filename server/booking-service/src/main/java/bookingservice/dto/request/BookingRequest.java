package bookingservice.dto.request;

import java.util.List;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Data
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingRequest {
    @NotNull(message = "SHOWTIME_ID_REQUIRED")
    @Min(value = 1, message = "SHOWTIME_ID_INVALID")
    Long showtimeId;

    @NotEmpty(message = "SEAT_LIST_REQUIRED")
    @Size(max = 8, message = "MAX_SEATS_EXCEEDED") // Tối đa 8 ghế
    List<Long> seatIds;

    @Min(value = 0, message = "POINTS_CANNOT_BE_NEGATIVE")
    Integer pointsUsed = 0;
}
