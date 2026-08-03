package movieservice.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import movieservice.enums.PriceRateDayType;

import java.math.BigDecimal;
import java.time.LocalTime;

public record PriceRateRequest(
        @NotBlank String name,
        @NotNull PriceRateDayType dayType,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        Integer formatId,
        @NotNull @DecimalMin("0.01") BigDecimal standardPrice,
        @NotNull @DecimalMin("0.01") BigDecimal vipMultiplier,
        @NotNull @DecimalMin("0.01") BigDecimal coupleMultiplier,
        @NotNull @DecimalMin("0.01") BigDecimal accessibleMultiplier,
        Integer priority,
        Boolean active
) {
}
