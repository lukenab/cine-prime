package movieservice.service;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.CinemaClusterDemandProfileRequest;
import movieservice.dto.response.CinemaClusterDemandProfileResponse;
import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaClusterDemandProfile;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.CinemaClusterDemandProfileRepository;
import movieservice.repository.CinemaClusterRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin CRUD for {@link CinemaClusterDemandProfile} — the per-cluster demandTier/demandScore/
 * minDailyShows/maxDailyShowsPerMovie inputs the auto-showtime allocator reads
 * (AutoShowtimeCandidateSelector/Scorer). Before this, the only way a cluster got a profile row
 * was V33__backfill_default_cluster_demand_profile.sql, a one-time migration that stamped a
 * neutral NORMAL/50.00/1/4 default onto every ACTIVE cluster that didn't already have one — not
 * real analytics, and with no path to ever change it short of another migration or direct DB
 * access. This service (plus CinemaClusterService#approveCluster auto-creating the same default
 * on approval) replaces that: the migration file has been removed, since going forward a
 * cluster's profile is either created automatically on approval or set explicitly here.
 */
@Service
@RequiredArgsConstructor
public class CinemaClusterDemandProfileAdminService {

    private final CinemaClusterRepository clusterRepository;
    private final CinemaClusterDemandProfileRepository demandProfileRepository;

    public CinemaClusterDemandProfileResponse getByClusterId(Long clusterId) {
        CinemaClusterDemandProfile profile = demandProfileRepository.findByCluster_ClusterId(clusterId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_DEMAND_PROFILE_NOT_FOUND));
        return toResponse(profile);
    }

    /** Upsert semantics: creates the profile if this cluster doesn't have one yet (e.g. it
     *  predates the auto-create-on-approval hook, or was never approved through the normal
     *  workflow), otherwise updates the existing row in place. */
    @Transactional
    public CinemaClusterDemandProfileResponse upsert(Long clusterId, CinemaClusterDemandProfileRequest request, String actor) {
        CinemaCluster cluster = clusterRepository.findById(clusterId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));

        CinemaClusterDemandProfile profile = demandProfileRepository.findByCluster_ClusterId(clusterId)
                .orElseGet(() -> CinemaClusterDemandProfile.builder()
                        .cluster(cluster)
                        .createdBy(actor)
                        .build());

        profile.setDemandTier(request.demandTier());
        profile.setDemandScore(request.demandScore());
        profile.setMinDailyShows(request.minDailyShows());
        profile.setMaxDailyShowsPerMovie(request.maxDailyShowsPerMovie());
        profile.setUpdatedBy(actor);

        CinemaClusterDemandProfile saved = demandProfileRepository.save(profile);
        return toResponse(saved);
    }

    private CinemaClusterDemandProfileResponse toResponse(CinemaClusterDemandProfile profile) {
        return new CinemaClusterDemandProfileResponse(
                profile.getClusterId(),
                profile.getCluster() != null ? profile.getCluster().getClusterName() : null,
                profile.getDemandTier(),
                profile.getDemandScore(),
                profile.getMinDailyShows(),
                profile.getMaxDailyShowsPerMovie(),
                profile.getUniqueCustomerCount(),
                profile.getBookingCount(),
                profile.getRevenue(),
                profile.getCreatedAt(),
                profile.getUpdatedAt(),
                profile.getCreatedBy(),
                profile.getUpdatedBy()
        );
    }
}
