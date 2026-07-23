package movieservice.service.autoshowtime;

import java.math.BigDecimal;

public record ShowtimeScoreBreakdown(
        String daypart,
        BigDecimal movieDemandScore,
        BigDecimal clusterDemandScore,
        BigDecimal timeDemandScore,
        BigDecimal formatDemandScore,
        BigDecimal capacityFitScore,
        Integer expectedAttendance,
        Integer roomCapacity
) {
}
