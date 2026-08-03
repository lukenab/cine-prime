package movieservice.dto.response;

import movieservice.enums.PriceRateDayType;

import java.math.BigDecimal;
import java.time.LocalTime;

public record PriceRateResponse(
        Long priceRateId,
        String name,
        PriceRateDayType dayType,
        LocalTime startTime,
        LocalTime endTime,
        Integer formatId,
        String formatCode,
        BigDecimal standardPrice,
        BigDecimal vipMultiplier,
        BigDecimal coupleMultiplier,
        BigDecimal accessibleMultiplier,
        Integer priority,
        Boolean active
) {
}
