package movieservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.CinemaClusterDemandProfileRequest;
import movieservice.dto.response.CinemaClusterDemandProfileResponse;
import movieservice.service.CinemaClusterDemandProfileAdminService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin CRUD for a cinema cluster's {@code CinemaClusterDemandProfile} — see
 * CinemaClusterDemandProfileAdminService for why this replaces the V33 backfill migration.
 */
@RestController
@RequestMapping("/api/cinema-clusters/{clusterId}/demand-profile")
@RequiredArgsConstructor
public class CinemaClusterDemandProfileController {

    private final CinemaClusterDemandProfileAdminService demandProfileAdminService;

    @PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")
    @GetMapping
    public ApiResponse<CinemaClusterDemandProfileResponse> getByClusterId(@PathVariable Long clusterId) {
        return ApiResponse.<CinemaClusterDemandProfileResponse>builder()
                .code(HttpStatus.OK.value())
                .result(demandProfileAdminService.getByClusterId(clusterId))
                .build();
    }

    /** Upsert — creates the profile if this cluster doesn't have one yet, otherwise updates it. */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping
    public ApiResponse<CinemaClusterDemandProfileResponse> upsert(
            @PathVariable Long clusterId,
            @Valid @RequestBody CinemaClusterDemandProfileRequest request,
            Authentication authentication
    ) {
        return ApiResponse.<CinemaClusterDemandProfileResponse>builder()
                .code(HttpStatus.OK.value())
                .message("Cinema cluster demand profile saved")
                .result(demandProfileAdminService.upsert(clusterId, request, actor(authentication)))
                .build();
    }

    private String actor(Authentication authentication) {
        return authentication != null ? authentication.getName() : "system";
    }
}
