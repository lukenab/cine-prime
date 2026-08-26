package movieservice.controller;

import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.response.MovieScreeningVersionCatalogResponse;
import movieservice.dto.response.ScreeningVersionCatalogPageResponse;
import movieservice.enums.ScreeningVersionStatus;
import movieservice.service.MovieScreeningVersionService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Cross-movie read model for catalogue operations. Mutating a version remains
 * scoped to its movie resource so permissions and lifecycle rules cannot be
 * bypassed from this view.
 */
@RestController
@RequestMapping("/api/screening-versions")
@RequiredArgsConstructor
public class ScreeningVersionCatalogController {

    private final MovieScreeningVersionService screeningVersionService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_READ')")
    public ApiResponse<List<MovieScreeningVersionCatalogResponse>> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) ScreeningVersionStatus status,
            @RequestParam(required = false) Integer formatId,
            @RequestParam(required = false) List<Long> clusterIds,
            @RequestParam(defaultValue = "false") boolean attentionOnly
    ) {
        return ApiResponse.<List<MovieScreeningVersionCatalogResponse>>builder()
                .code(HttpStatus.OK.value())
                .result(screeningVersionService.searchCatalog(q, status, formatId, clusterIds, attentionOnly))
                .build();
    }

    @GetMapping("/page")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_READ')")
    public ApiResponse<ScreeningVersionCatalogPageResponse> searchPage(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) ScreeningVersionStatus status,
            @RequestParam(required = false) Integer formatId,
            @RequestParam(defaultValue = "ALL") String readiness,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.<ScreeningVersionCatalogPageResponse>builder()
                .code(HttpStatus.OK.value())
                .result(screeningVersionService.searchCatalogPage(q, status, formatId, readiness, page, size))
                .build();
    }
}
