package movieservice.dto.request;

import jakarta.validation.constraints.NotNull;
import movieservice.enums.ShowtimeDaypart;

import java.math.BigDecimal;
import java.time.LocalTime;

/**
 * Create/update entry for one {@code ShowtimeDaypartPolicy} row, nested inside
 * {@link ShowtimeAllocationPolicyRequest#daypartPolicies()}. Mirrors the existing
 * formatPriorities full-replace pattern on the same parent request.
 */
public record ShowtimeDaypartPolicyRequest(
        @NotNull
        ShowtimeDaypart daypartCode,

        @NotNull
        LocalTime startTime,

        @NotNull
        LocalTime endTime,

        @NotNull
        BigDecimal weekdayDemandMultiplier,

        @NotNull
        BigDecimal weekendDemandMultiplier,

        Boolean active
) {
}
