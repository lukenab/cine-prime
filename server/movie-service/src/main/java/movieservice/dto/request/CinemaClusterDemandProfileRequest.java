package movieservice.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import movieservice.enums.DemandTier;

import java.math.BigDecimal;

/**
 * Admin create/update payload for {@code CinemaClusterDemandProfile}. Previously this entity
 * had no API at all — every cluster's demandTier/demandScore/minDailyShows/
 * maxDailyShowsPerMovie was DB/migration-only (see V33__backfill_default_cluster_demand_profile
 * .sql, which stopgap-seeded a neutral NORMAL/50/1/4 default for every ACTIVE cluster because
 * there was no admin screen to configure real values). This is that screen's payload.
 */
public record CinemaClusterDemandProfileRequest(
        @NotNull
        DemandTier demandTier,

        @NotNull
        BigDecimal demandScore,

        @NotNull
        @PositiveOrZero
        Integer minDailyShows,

        @NotNull
        @PositiveOrZero
        Integer maxDailyShowsPerMovie
) {
}
