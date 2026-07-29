package bookingservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class CounterSaleRequest {
    @NotNull
    private Long showtimeId;

    @NotEmpty
    @Size(max = 8)
    private List<@NotNull Long> seatIds;

    @NotBlank
    @Size(max = 50)
    private String terminalId;

    @NotBlank
    @Size(max = 50)
    private String paymentMethod;

    @NotBlank
    @Size(max = 100)
    private String receiptReference;
}
