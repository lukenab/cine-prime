package movieservice.dto.response;

import java.time.LocalDate;

public record AutoShowtimeGenerationPolicyResponse(
        String policyCode,
        String businessTimezone,
        Integer planningHorizonStartDays,
        Integer planningHorizonEndDays,
        LocalDate earliestAllowedDate,
        LocalDate latestAllowedDate
) {
}
