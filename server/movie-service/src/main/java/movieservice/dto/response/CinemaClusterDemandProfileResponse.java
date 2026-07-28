package movieservice.dto.response;

import movieservice.enums.DemandTier;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CinemaClusterDemandProfileResponse(
        Long clusterId,
        String clusterName,
        DemandTier demandTier,
        BigDecimal demandScore,
        Integer minDailyShows,
        Integer maxDailyShowsPerMovie,
        Long uniqueCustomerCount,
        Long bookingCount,
        BigDecimal revenue,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String createdBy,
        String updatedBy
) {
}
