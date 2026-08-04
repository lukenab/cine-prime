package bookingservice.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class CreateBookingRequest {
    @NotNull
    private Long showtimeId;

    @NotEmpty
    @Size(max = 8)
    private List<@NotNull Long> seatIds;

    /** Optional customer-entered code. Pricing is always evaluated server-side. */
    @Size(max = 64)
    private String promotionCode;
}
