package bookingservice.dto.request;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;


@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class HoldSeatRequest {
   @NotNull(message = "Showtime ID cannot be null")
    Long showtimeId;

    @NotBlank(message = "Account ID cannot be blank")
    String accountId;

    @NotEmpty(message = "Seat IDs list cannot be empty")
    List<String> seatIds;
}
