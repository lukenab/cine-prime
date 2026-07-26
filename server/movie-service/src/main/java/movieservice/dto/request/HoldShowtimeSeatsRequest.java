package movieservice.dto.request;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class HoldShowtimeSeatsRequest {

    @NotEmpty(message = "At least one seat must be selected.")
    @Size(max = 8, message = "A maximum of 8 seats can be held in one booking.")
    List<Long> seatIds;
}
