package movieservice.service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.CinemaClusterRequest;
import movieservice.dto.response.CinemaClusterResponse;
import movieservice.entity.CinemaCluster;
import movieservice.entity.ClusterAuditLog;
import movieservice.enums.ClusterAction;
import movieservice.enums.ClusterStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.ClusterAuditLogRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CinemaClusterService {
    private static final String DEFAULT_HOTLINE = "19001000";

    CinemaClusterRepository cinemaClusterRepository;
    ClusterAuditLogRepository clusterAuditLogRepository;
    MovieMapper movieMapper;

    @Transactional
    public CinemaClusterResponse createCluster(CinemaClusterRequest req, Authentication authentication) {
        String actor = getActor(authentication);
        String clusterName = req.getClusterName().trim();
        if (cinemaClusterRepository.existsByClusterNameIgnoreCase(clusterName)) {
            throw new AppException(MovieErrorCode.CLUSTER_NAME_EXISTED);
        }

        CinemaCluster cluster = movieMapper.toCinemaCluster(req);
        cluster.setClusterName(clusterName);
        cluster.setProvince(req.getProvince().trim());
        cluster.setAddress(req.getAddress().trim());
        cluster.setPhoneNumber(DEFAULT_HOTLINE);

        ClusterStatus iniStatus = isAdminRole(authentication) ? ClusterStatus.ACTIVE : ClusterStatus.DRAFT;
        cluster.setStatus(iniStatus);
        cluster.setCreatedBy(actor);

        CinemaCluster saved = cinemaClusterRepository.save(cluster);

        logAction(saved.getClusterId(), ClusterAction.CREATE, actor,
                null, iniStatus, null);
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

        cluster.setClusterName(newName);
        cluster.setProvince(req.getProvince().trim());
        cluster.setAddress(req.getAddress().trim());

        if (req.getLatitude() != null) {
            cluster.setLatitude(req.getLatitude());
        }
        if (req.getLongitude() != null) {
            cluster.setLongitude(req.getLongitude());
        }
        if (oldStatus == ClusterStatus.DRAFT) {
            cluster.setRejectionNote(null);
        }

        cluster.setUpdatedBy(actor);

        CinemaCluster saved = cinemaClusterRepository.save(cluster);

        logAction(saved.getClusterId(), action, actor,
                oldStatus, saved.getStatus(), null);

        return toResponseWithStats(saved);
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
