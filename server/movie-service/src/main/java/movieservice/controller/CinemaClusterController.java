package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.CinemaClusterRequest;
import movieservice.dto.request.RejectRequest;
import movieservice.dto.response.CinemaClusterResponse;
import movieservice.dto.response.ClusterAuditLogResponse;
import movieservice.entity.CinemaCluster;
import movieservice.entity.ClusterAuditLog;
import movieservice.enums.ClusterAction;
import movieservice.enums.ClusterStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.ClusterAuditLogRepository;
import movieservice.service.CinemaClusterService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/cinema-clusters")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CinemaClusterController {

    CinemaClusterRepository clusterRepository;
    ClusterAuditLogRepository auditLogRepository;
    CinemaClusterService cinemaClusterService;
    MovieMapper movieMapper;

    // ── GET all ───────────────────────────────────────────────────────────────
    // Public / unauthenticated → chỉ thấy ACTIVE
    // ADMIN / SUPER_ADMIN → thấy tất cả status

    @GetMapping
    public ApiResponse<List<CinemaClusterResponse>> getAll(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            Authentication authentication) {

        boolean isAdmin = isStaff(authentication);
        List<CinemaCluster> clusters;

        if (q != null && !q.isBlank()) {
            clusters = clusterRepository
                    .findByClusterNameContainingIgnoreCaseOrProvinceContainingIgnoreCase(q, q);
            if (!isAdmin) {
                clusters = clusters.stream()
                        .filter(c -> c.getStatus() == ClusterStatus.ACTIVE)
                        .toList();
            }
        } else if (status != null && !status.isBlank()) {
            ClusterStatus requestedStatus;
            try {
                requestedStatus = ClusterStatus.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new AppException(MovieErrorCode.INVALID_CLUSTER_STATUS);
            }
            // Non-admin chỉ được filter ACTIVE
            if (!isAdmin && requestedStatus != ClusterStatus.ACTIVE) {
                requestedStatus = ClusterStatus.ACTIVE;
            }
            clusters = clusterRepository.findByStatus(requestedStatus);
        } else {
            clusters = isAdmin
                    ? clusterRepository.findAll()
                    : clusterRepository.findByStatus(ClusterStatus.ACTIVE);
        }

        return ApiResponse.<List<CinemaClusterResponse>>builder()
                .code(200)
                .result(clusters.stream().map(this::toResponseWithStats).toList())
                .build();
    }

    // ── GET by id ─────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    public ApiResponse<CinemaClusterResponse> getById(@PathVariable Long id) {
        CinemaCluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));
        return ApiResponse.<CinemaClusterResponse>builder()
                .code(200).result(toResponseWithStats(cluster)).build();
    }

    // ── POST create → EMPLOYEE: DRAFT (needs approval) / ADMIN: ACTIVE (self-approved) ──

    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PostMapping
    public ApiResponse<CinemaClusterResponse> create(
            @Valid @RequestBody CinemaClusterRequest req,
            Authentication authentication) {
        return ApiResponse.<CinemaClusterResponse>builder()
                .code(201)
                .result(cinemaClusterService.createCluster(req, authentication))
                .build();
    }

    // ── PUT update data (+ ACTIVE↔INACTIVE toggle) ────────────────────────────

    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PutMapping("/{id}")
    public ApiResponse<CinemaClusterResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody CinemaClusterRequest req,
            Authentication authentication) {
        return ApiResponse.<CinemaClusterResponse>builder()
                .code(200)
                .result(cinemaClusterService.updateCluster(id, req, authentication))
                .build();
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        if (!clusterRepository.existsById(id))
            throw new AppException(MovieErrorCode.CLUSTER_NOT_FOUND);

        int roomCount = clusterRepository.countRoomsByClusterId(id);
        if (roomCount > 0)
            throw new AppException(MovieErrorCode.CLUSTER_HAS_ROOMS);

        clusterRepository.deleteById(id);
        return ApiResponse.<Void>builder().code(200).message("Deleted").build();
    }

    // ── WORKFLOW: submit (DRAFT → PENDING_REVIEW) ─────────────────────────────

    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PostMapping("/{id}/submit")
    public ApiResponse<CinemaClusterResponse> submit(
            @PathVariable Long id,
            Authentication authentication) {

        CinemaCluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));

        if (cluster.getStatus() != ClusterStatus.DRAFT) {
            throw new AppException(MovieErrorCode.CLUSTER_INVALID_TRANSITION);
        }

        ClusterStatus oldStatus = cluster.getStatus();
        cluster.setStatus(ClusterStatus.PENDING_REVIEW);
        cluster.setRejectionNote(null); // clear previous rejection note on re-submit
        CinemaCluster saved = clusterRepository.save(cluster);

        logAction(saved.getClusterId(), ClusterAction.SUBMIT, getActor(authentication),
                oldStatus, ClusterStatus.PENDING_REVIEW, null);

        return ApiResponse.<CinemaClusterResponse>builder()
                .code(200).result(toResponseWithStats(saved)).build();
    }

    // ── WORKFLOW: approve (PENDING_REVIEW → ACTIVE) ───────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/approve")
    public ApiResponse<CinemaClusterResponse> approve(
            @PathVariable Long id,
            Authentication authentication) {

        CinemaCluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));

        if (cluster.getStatus() != ClusterStatus.PENDING_REVIEW) {
            throw new AppException(MovieErrorCode.CLUSTER_INVALID_TRANSITION);
        }

        ClusterStatus oldStatus = cluster.getStatus();
        cluster.setStatus(ClusterStatus.ACTIVE);
        CinemaCluster saved = clusterRepository.save(cluster);

        logAction(saved.getClusterId(), ClusterAction.APPROVE, getActor(authentication),
                oldStatus, ClusterStatus.ACTIVE, null);

        return ApiResponse.<CinemaClusterResponse>builder()
                .code(200).result(toResponseWithStats(saved)).build();
    }

    // ── WORKFLOW: reject (PENDING_REVIEW → DRAFT) ─────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/reject")
    public ApiResponse<CinemaClusterResponse> reject(
            @PathVariable Long id,
            @Valid @RequestBody RejectRequest req,
            Authentication authentication) {

        CinemaCluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));

        if (cluster.getStatus() != ClusterStatus.PENDING_REVIEW) {
            throw new AppException(MovieErrorCode.CLUSTER_INVALID_TRANSITION);
        }

        ClusterStatus oldStatus = cluster.getStatus();
        cluster.setStatus(ClusterStatus.DRAFT);
        cluster.setRejectionNote(req.getNote());
        CinemaCluster saved = clusterRepository.save(cluster);

        logAction(saved.getClusterId(), ClusterAction.REJECT, getActor(authentication),
                oldStatus, ClusterStatus.DRAFT, req.getNote());

        return ApiResponse.<CinemaClusterResponse>builder()
                .code(200).result(toResponseWithStats(saved)).build();
    }

    // ── GET audit log ─────────────────────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}/audit-log")
    public ApiResponse<List<ClusterAuditLogResponse>> getAuditLog(@PathVariable Long id) {
        if (!clusterRepository.existsById(id))
            throw new AppException(MovieErrorCode.CLUSTER_NOT_FOUND);

        List<ClusterAuditLogResponse> result = auditLogRepository
                .findByClusterIdOrderByTimestampDesc(id)
                .stream()
                .map(this::toAuditLogResponse)
                .toList();

        return ApiResponse.<List<ClusterAuditLogResponse>>builder()
                .code(200).result(result).build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private CinemaClusterResponse toResponseWithStats(CinemaCluster cluster) {
        CinemaClusterResponse res = movieMapper.toCinemaClusterResponse(cluster);
        res.setTotalRooms(clusterRepository.countRoomsByClusterId(cluster.getClusterId()));
        res.setTotalSeats(clusterRepository.countSeatsByClusterId(cluster.getClusterId()));
        return res;
    }

    private ClusterAuditLogResponse toAuditLogResponse(ClusterAuditLog log) {
        return ClusterAuditLogResponse.builder()
                .logId(log.getLogId())
                .clusterId(log.getClusterId())
                .action(log.getAction().name())
                .performedBy(log.getPerformedBy())
                .oldStatus(log.getOldStatus())
                .newStatus(log.getNewStatus())
                .note(log.getNote())
                .timestamp(log.getTimestamp())
                .build();
    }

    private void logAction(Long clusterId, ClusterAction action, String performedBy,
            ClusterStatus oldStatus, ClusterStatus newStatus, String note) {
        ClusterAuditLog entry = new ClusterAuditLog();
        entry.setClusterId(clusterId);
        entry.setAction(action);
        entry.setPerformedBy(performedBy);
        entry.setOldStatus(oldStatus != null ? oldStatus.name() : null);
        entry.setNewStatus(newStatus != null ? newStatus.name() : null);
        entry.setNote(note);
        entry.setTimestamp(LocalDateTime.now());
        auditLogRepository.save(entry);
    }

    /** ADMIN và EMPLOYEE đều là internal staff — thấy tất cả status trong GET */
    private boolean isStaff(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return false;
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")
             || a.getAuthority().equals("ROLE_EMPLOYEE"));
    }

    /** Kiểm tra đúng role ADMIN (không bao gồm EMPLOYEE) */
    private boolean isAdminRole(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return false;
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    private String getActor(Authentication authentication) {
        return authentication != null ? authentication.getName() : "UNKNOWN";
    }
}
