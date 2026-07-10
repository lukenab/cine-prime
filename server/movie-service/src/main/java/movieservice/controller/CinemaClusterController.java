package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.CinemaClusterRequest;
import movieservice.dto.response.CinemaClusterResponse;
import movieservice.entity.CinemaCluster;
import movieservice.enums.ClusterStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaClusterRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinema-clusters")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CinemaClusterController {

    CinemaClusterRepository clusterRepository;
    MovieMapper movieMapper;

    // ── GET all (optional filter by status or search query) ──────────────────

    @GetMapping
    public ApiResponse<List<CinemaClusterResponse>> getAll(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status) {

        List<CinemaCluster> clusters;

        if (q != null && !q.isBlank()) {
            clusters = clusterRepository
                    .findByClusterNameContainingIgnoreCaseOrProvinceContainingIgnoreCase(q, q);
        } else if (status != null && !status.isBlank()) {
            try {
                clusters = clusterRepository.findByStatus(ClusterStatus.valueOf(status.toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new AppException(MovieErrorCode.INVALID_CLUSTER_STATUS);
            }
        } else {
            clusters = clusterRepository.findAll();
        }

        List<CinemaClusterResponse> result = clusters.stream()
                .map(this::toResponseWithStats)
                .toList();

        return ApiResponse.<List<CinemaClusterResponse>>builder()
                .code(200).result(result).build();
    }

    // ── GET by id ─────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    public ApiResponse<CinemaClusterResponse> getById(@PathVariable Long id) {
        CinemaCluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));
        return ApiResponse.<CinemaClusterResponse>builder()
                .code(200).result(toResponseWithStats(cluster)).build();
    }

    // ── POST create ───────────────────────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ApiResponse<CinemaClusterResponse> create(@Valid @RequestBody CinemaClusterRequest req) {
        CinemaCluster cluster = movieMapper.toCinemaCluster(req);
        cluster.setClusterName(req.getClusterName().trim());
        cluster.setProvince(req.getProvince().trim());
        cluster.setAddress(req.getAddress().trim());
        if (req.getPhoneNumber() != null) cluster.setPhoneNumber(req.getPhoneNumber().trim());
        if (req.getStatus() != null) cluster.setStatus(req.getStatus());
        CinemaCluster saved = clusterRepository.save(cluster);
        return ApiResponse.<CinemaClusterResponse>builder()
                .code(201).result(toResponseWithStats(saved)).build();
    }

    // ── PUT update ────────────────────────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ApiResponse<CinemaClusterResponse> update(@PathVariable Long id,
                                                      @Valid @RequestBody CinemaClusterRequest req) {
        CinemaCluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));

        cluster.setClusterName(req.getClusterName().trim());
        cluster.setProvince(req.getProvince().trim());
        cluster.setAddress(req.getAddress().trim());
        cluster.setPhoneNumber(req.getPhoneNumber());
        if (req.getStatus() != null) cluster.setStatus(req.getStatus());

        return ApiResponse.<CinemaClusterResponse>builder()
                .code(200).result(toResponseWithStats(clusterRepository.save(cluster))).build();
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

    // ── Helper: enrich response with totalRooms + totalSeats ─────────────────

    private CinemaClusterResponse toResponseWithStats(CinemaCluster cluster) {
        CinemaClusterResponse res = movieMapper.toCinemaClusterResponse(cluster);
        res.setTotalRooms(clusterRepository.countRoomsByClusterId(cluster.getClusterId()));
        res.setTotalSeats(clusterRepository.sumSeatsByClusterId(cluster.getClusterId()));
        return res;
    }
}
