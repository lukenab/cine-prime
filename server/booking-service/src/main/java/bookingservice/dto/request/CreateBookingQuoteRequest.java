package bookingservice.dto.request;

import java.util.List;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateBookingQuoteRequest(
        @NotNull @Min(1) Long showtimeId,
        @NotEmpty @Size(max = 8) List<Long> showtimeSeatIds,
        @Size(max = 100) String promotionCode) {
}
