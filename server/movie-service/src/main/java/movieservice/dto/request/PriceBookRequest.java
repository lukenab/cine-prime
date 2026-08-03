package movieservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public record PriceBookRequest(
        @NotNull Long clusterId,
        @NotBlank String code,
        @NotBlank String name,
        @NotBlank String currencyCode,
        @NotNull LocalDate validFrom,
        LocalDate validTo,
        Integer priority,
        @Valid List<PriceRateRequest> rates
) {
}
