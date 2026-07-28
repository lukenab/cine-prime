package movieservice.dto.response;

import movieservice.enums.ShowtimeDaypart;

import java.math.BigDecimal;
import java.time.LocalTime;

public record ShowtimeDaypartPolicyResponse(
        Long daypartPolicyId,
        ShowtimeDaypart daypartCode,
        LocalTime startTime,
        LocalTime endTime,
        BigDecimal weekdayDemandMultiplier,
        BigDecimal weekendDemandMultiplier,
        Boolean active
) {
}
