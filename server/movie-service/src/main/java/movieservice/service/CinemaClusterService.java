package movieservice.service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.CinemaClusterRequest;
import movieservice.dto.request.ClusterOperatingHourRequest;
import movieservice.dto.response.CinemaClusterResponse;
import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaClusterDemandProfile;
import movieservice.entity.CinemaClusterOperatingHour;
import movieservice.entity.ClusterAuditLog;
import movieservice.enums.ClusterAction;
import movieservice.enums.ClusterStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaClusterDemandProfileRepository;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.ClusterAuditLogRepository;
import movieservice.repository.MovieAvailabilityRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.DayOfWeek;
import java.time.ZoneId;
import java.time.DateTimeException;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CinemaClusterService {
    private static final String DEFAULT_HOTLINE = "19001000";
    private static final String DEFAULT_PUBLIC_EMAIL = "contact@cineprime.vn";

    CinemaClusterRepository cinemaClusterRepository;
    ClusterAuditLogRepository clusterAuditLogRepository;
    MovieAvailabilityRepository movieAvailabilityRepository;
    CinemaClusterDemandProfileRepository cinemaClusterDemandProfileRepository;
    MovieMapper movieMapper;

    private static final List<ClusterAction> NON_DELETABLE_HISTORY = List.of(
            ClusterAction.SUBMIT,
            ClusterAction.APPROVE,
            ClusterAction.DEACTIVATE,
            ClusterAction.REACTIVATE);

    @Transactional
    public CinemaClusterResponse createCluster(CinemaClusterRequest req, Authentication authentication) {
        String actor = getActor(authentication);
        String clusterName = req.getClusterName().trim();
        if (cinemaClusterRepository.existsByClusterNameIgnoreCase(clusterName)) {
            throw new AppException(MovieErrorCode.CLUSTER_NAME_EXISTED);
        }
        String clusterCode = normalizeCode(req.getClusterCode());
        if (cinemaClusterRepository.existsByClusterCodeIgnoreCase(clusterCode)) {
            throw new AppException(MovieErrorCode.CLUSTER_CODE_EXISTED);
        }
        validateOperationalConfiguration(req);

        CinemaCluster cluster = movieMapper.toCinemaCluster(req);
        cluster.setClusterCode(clusterCode);
        cluster.setClusterName(clusterName);
        applyClusterDetails(cluster, req);
        cluster.setPhoneNumber(DEFAULT_HOTLINE);
        cluster.setPublicEmail(DEFAULT_PUBLIC_EMAIL);
        replaceOperatingHours(cluster, req.getOperatingHours());

        cluster.setStatus(ClusterStatus.DRAFT);
        cluster.setCreatedBy(actor);

        CinemaCluster saved = cinemaClusterRepository.save(cluster);

        logAction(saved.getClusterId(), ClusterAction.CREATE, actor,
                null, ClusterStatus.DRAFT, null);
        return toResponseWithStats(saved);
    }

    @Transactional
    public CinemaClusterResponse updateCluster(
            Long id,
            CinemaClusterRequest req,
            Authentication authentication) {

        String actor = getActor(authentication);

        CinemaCluster cluster = cinemaClusterRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));

        ClusterStatus oldStatus = cluster.getStatus();
        ClusterAction action = ClusterAction.UPDATE;
        boolean isAdmin = isAdminRole(authentication);

        if (!isAdmin && oldStatus != ClusterStatus.DRAFT) {
            throw new AppException(MovieErrorCode.CLUSTER_INVALID_TRANSITION);
        }

        if (req.getStatus() != null) {
            ClusterStatus newStatus = req.getStatus();

            if (newStatus == ClusterStatus.DRAFT || newStatus == ClusterStatus.PENDING_REVIEW) {
                throw new AppException(MovieErrorCode.CLUSTER_INVALID_TRANSITION);
            }

            if (!isAdmin) {
                throw new AppException(MovieErrorCode.CLUSTER_INVALID_TRANSITION);
            }

            boolean validToggle =
                    (oldStatus == ClusterStatus.ACTIVE && newStatus == ClusterStatus.INACTIVE)
                            || (oldStatus == ClusterStatus.INACTIVE && newStatus == ClusterStatus.ACTIVE);

            if (!validToggle && oldStatus != newStatus) {
                throw new AppException(MovieErrorCode.CLUSTER_INVALID_TRANSITION);
            }

            if (newStatus == ClusterStatus.INACTIVE) {
                action = ClusterAction.DEACTIVATE;
            } else if (newStatus == ClusterStatus.ACTIVE && oldStatus == ClusterStatus.INACTIVE) {
                action = ClusterAction.REACTIVATE;
            }

            cluster.setStatus(newStatus);
        }

        String newName = req.getClusterName().trim();
        if (cinemaClusterRepository.existsByClusterNameIgnoreCaseAndClusterIdNot(newName, id)) {
            throw new AppException(MovieErrorCode.CLUSTER_NAME_EXISTED);
        }

        String newCode = normalizeCode(req.getClusterCode());
        if (!newCode.equalsIgnoreCase(cluster.getClusterCode()) && oldStatus != ClusterStatus.DRAFT) {
            throw new AppException(MovieErrorCode.CLUSTER_CODE_IMMUTABLE);
        }
        if (cinemaClusterRepository.existsByClusterCodeIgnoreCaseAndClusterIdNot(newCode, id)) {
            throw new AppException(MovieErrorCode.CLUSTER_CODE_EXISTED);
        }
        validateOperationalConfiguration(req);

        cluster.setClusterCode(newCode);
        cluster.setClusterName(newName);
        applyClusterDetails(cluster, req);
        replaceOperatingHours(cluster, req.getOperatingHours());
        if (oldStatus == ClusterStatus.DRAFT) {
            cluster.setRejectionNote(null);
        }

        cluster.setUpdatedBy(actor);

        CinemaCluster saved = cinemaClusterRepository.save(cluster);

        logAction(saved.getClusterId(), action, actor,
                oldStatus, saved.getStatus(), null);

        return toResponseWithStats(saved);
    }

    /**
     * Permanently removes only a never-used cluster draft. Operational clusters
     * remain addressable and must use the suspension/retirement lifecycle.
     */
    @Transactional
    public void deleteUnusedDraft(Long id, Authentication authentication) {
        if (!isAdminRole(authentication)) {
            throw new AppException(MovieErrorCode.CLUSTER_DELETE_FORBIDDEN);
        }

        CinemaCluster cluster = cinemaClusterRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));

        if (cluster.getStatus() != ClusterStatus.DRAFT
                || (cluster.getRejectionNote() != null && !cluster.getRejectionNote().isBlank())
                || clusterAuditLogRepository.existsByClusterIdAndActionIn(id, NON_DELETABLE_HISTORY)) {
            throw new AppException(MovieErrorCode.CLUSTER_DELETE_NOT_ALLOWED);
        }

        if (cinemaClusterRepository.countRoomsByClusterId(id) > 0) {
            throw new AppException(MovieErrorCode.CLUSTER_HAS_ROOMS);
        }

        if (movieAvailabilityRepository.existsByCluster_ClusterId(id)) {
            throw new AppException(MovieErrorCode.CLUSTER_HAS_MOVIE_AVAILABILITY);
        }

        String actor = getActor(authentication);
        logAction(id, ClusterAction.DELETE, actor, ClusterStatus.DRAFT, null,
                "Permanently deleted unused draft cinema cluster [code=" + cluster.getClusterCode() + "]");
        cinemaClusterRepository.delete(cluster);
    }

    @Transactional
    public CinemaClusterResponse submitCluster(Long id, Authentication authentication) {
        CinemaCluster cluster = lockCluster(id);
        if (cluster.getStatus() != ClusterStatus.DRAFT) {
            throw new AppException(MovieErrorCode.CLUSTER_INVALID_TRANSITION);
        }

        String actor = getActor(authentication);
        if (!isAdminRole(authentication) && !actor.equals(cluster.getCreatedBy())) {
            throw new AppException(MovieErrorCode.CLUSTER_NOT_OWNER);
        }

        cluster.setStatus(ClusterStatus.PENDING_REVIEW);
        cluster.setRejectionNote(null);
        cluster.setUpdatedBy(actor);
        CinemaCluster saved = cinemaClusterRepository.save(cluster);
        logAction(id, ClusterAction.SUBMIT, actor,
                ClusterStatus.DRAFT, ClusterStatus.PENDING_REVIEW, null);
        return toResponseWithStats(saved);
    }

    @Transactional
    public CinemaClusterResponse approveCluster(Long id, Authentication authentication) {
        CinemaCluster cluster = lockCluster(id);
        if (cluster.getStatus() != ClusterStatus.PENDING_REVIEW) {
            throw new AppException(MovieErrorCode.CLUSTER_INVALID_TRANSITION);
        }

        String actor = getActor(authentication);
        if (actor.equals(cluster.getCreatedBy())) {
            throw new AppException(MovieErrorCode.CLUSTER_SELF_APPROVAL_FORBIDDEN);
        }

        cluster.setStatus(ClusterStatus.ACTIVE);
        cluster.setUpdatedBy(actor);
        CinemaCluster saved = cinemaClusterRepository.save(cluster);
        ensureDefaultDemandProfile(saved, actor);
        logAction(id, ClusterAction.APPROVE, actor,
                ClusterStatus.PENDING_REVIEW, ClusterStatus.ACTIVE, null);
        return toResponseWithStats(saved);
    }

    @Transactional
    public CinemaClusterResponse rejectCluster(Long id, String note, Authentication authentication) {
        CinemaCluster cluster = lockCluster(id);
        if (cluster.getStatus() != ClusterStatus.PENDING_REVIEW) {
            throw new AppException(MovieErrorCode.CLUSTER_INVALID_TRANSITION);
        }

        String actor = getActor(authentication);
        if (actor.equals(cluster.getCreatedBy())) {
            throw new AppException(MovieErrorCode.CLUSTER_SELF_APPROVAL_FORBIDDEN);
        }

        cluster.setStatus(ClusterStatus.DRAFT);
        cluster.setRejectionNote(note);
        cluster.setUpdatedBy(actor);
        CinemaCluster saved = cinemaClusterRepository.save(cluster);
        logAction(id, ClusterAction.REJECT, actor,
                ClusterStatus.PENDING_REVIEW, ClusterStatus.DRAFT, note);
        return toResponseWithStats(saved);
    }

    /**
     * Auto-creates a neutral default demand profile (NORMAL / 50.00 / 1 daily show min /
     * 4 per movie max) the moment a cluster becomes ACTIVE, if it doesn't already have one.
     * This replaces V33__backfill_default_cluster_demand_profile.sql (removed): that migration
     * was a one-time stopgap backfill for clusters that predated any admin-facing way to set a
     * profile; now every cluster gets one automatically on approval, and an admin can edit the
     * real values afterward via CinemaClusterDemandProfileController instead of waiting on
     * another migration. Same default values as the old migration, for continuity.
     */
    private void ensureDefaultDemandProfile(CinemaCluster cluster, String actor) {
        if (cinemaClusterDemandProfileRepository.findByCluster_ClusterId(cluster.getClusterId()).isPresent()) {
            return;
        }
        CinemaClusterDemandProfile profile = CinemaClusterDemandProfile.builder()
                .cluster(cluster)
                .demandTier(movieservice.enums.DemandTier.NORMAL)
                .demandScore(new java.math.BigDecimal("50.00"))
                .minDailyShows(1)
                .maxDailyShowsPerMovie(4)
                .createdBy(actor)
                .updatedBy(actor)
                .build();
        cinemaClusterDemandProfileRepository.save(profile);
    }

    private CinemaCluster lockCluster(Long id) {
        return cinemaClusterRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));
    }

    private void applyClusterDetails(CinemaCluster cluster, CinemaClusterRequest req) {
        cluster.setCoverImageUrl(normalizeOptional(req.getCoverImageUrl(), false));
        cluster.setVenueType(req.getVenueType());
        cluster.setOpeningDate(req.getOpeningDate());
        cluster.setCountryCode(req.getCountryCode().trim().toUpperCase(Locale.ROOT));
        cluster.setProvince(req.getProvince().trim());
        cluster.setWard(normalizeOptional(req.getWard(), false));
        cluster.setPostalCode(normalizeOptional(req.getPostalCode(), false));
        cluster.setBuildingName(normalizeOptional(req.getBuildingName(), false));
        cluster.setFloorLocation(normalizeOptional(req.getFloorLocation(), false));
        cluster.setAddress(req.getAddress().trim());
        cluster.setLatitude(req.getLatitude());
        cluster.setLongitude(req.getLongitude());
        cluster.setTimezone(req.getTimezone().trim());
    }

    private void validateOperationalConfiguration(CinemaClusterRequest req) {
        try {
            ZoneId.of(req.getTimezone().trim());
        } catch (DateTimeException | NullPointerException exception) {
            throw new AppException(MovieErrorCode.CLUSTER_TIMEZONE_INVALID);
        }

        List<ClusterOperatingHourRequest> hours = req.getOperatingHours();
        if (hours == null || hours.size() != DayOfWeek.values().length) {
            throw new AppException(MovieErrorCode.CLUSTER_OPERATING_HOURS_INVALID);
        }
        Set<DayOfWeek> uniqueDays = new HashSet<>();
        for (ClusterOperatingHourRequest hour : hours) {
            if (hour == null || hour.getDayOfWeek() == null || !hour.isScheduleValid()
                    || !uniqueDays.add(hour.getDayOfWeek())) {
                throw new AppException(MovieErrorCode.CLUSTER_OPERATING_HOURS_INVALID);
            }
        }
    }

    /**
     * Updates existing rows in place (keyed by dayOfWeek) instead of clear()-then-recreate.
     * validateOperationalConfiguration() guarantees requests always covers exactly the 7
     * DayOfWeek values with no duplicates, so every existing row always has a matching
     * request entry - no adds/removes are ever actually needed on update, only field
     * mutation. clear()-then-add() previously caused a transient uq_cluster_operating_day
     * (cluster_id, day_of_week) violation: with IDENTITY-generated rows, Hibernate issues
     * the INSERT for the re-added Monday row immediately on add(), before the DELETE for
     * the orphan-removed old Monday row is flushed - a well-known Hibernate flush-ordering
     * hazard for @OneToMany+orphanRemoval collections reusing a unique business key.
     */
    private void replaceOperatingHours(CinemaCluster cluster, List<ClusterOperatingHourRequest> requests) {
        Map<DayOfWeek, CinemaClusterOperatingHour> existingByDay = cluster.getOperatingHours().stream()
                .collect(Collectors.toMap(CinemaClusterOperatingHour::getDayOfWeek, Function.identity()));

        for (ClusterOperatingHourRequest request : requests) {
            CinemaClusterOperatingHour hour = existingByDay.get(request.getDayOfWeek());
            if (hour == null) {
                hour = CinemaClusterOperatingHour.builder()
                        .cluster(cluster)
                        .dayOfWeek(request.getDayOfWeek())
                        .build();
                cluster.getOperatingHours().add(hour);
            }
            hour.setOpensAt(request.getOpensAt());
            hour.setClosesAt(request.getClosesAt());
            hour.setClosesNextDay(request.isClosesNextDay());
            hour.setClosed(request.isClosed());
        }
    }

    private String normalizeCode(String value) {
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeOptional(String value, boolean lowercase) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim();
        return lowercase ? normalized.toLowerCase(Locale.ROOT) : normalized;
    }

    private CinemaClusterResponse toResponseWithStats(CinemaCluster cluster) {
        CinemaClusterResponse res = movieMapper.toCinemaClusterResponse(cluster);
        res.setTotalRooms(cinemaClusterRepository.countRoomsByClusterId(cluster.getClusterId()));
        res.setTotalSeats(cinemaClusterRepository.countSeatsByClusterId(cluster.getClusterId()));
        return res;
    }

    private boolean isAdminRole(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }

        return authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"));
    }

    private String getActor(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return "UNKNOWN";
        }

        return authentication.getName();
    }

    private void logAction(
            Long clusterId,
            ClusterAction action,
            String performedBy,
            ClusterStatus oldStatus,
            ClusterStatus newStatus,
            String note) {

        ClusterAuditLog entry = new ClusterAuditLog();
        entry.setClusterId(clusterId);
        entry.setAction(action);
        entry.setPerformedBy(performedBy);
        entry.setOldStatus(oldStatus != null ? oldStatus.name() : null);
        entry.setNewStatus(newStatus != null ? newStatus.name() : null);
        entry.setNote(note);
        entry.setTimestamp(LocalDateTime.now());
        clusterAuditLogRepository.save(entry);
    }

}
