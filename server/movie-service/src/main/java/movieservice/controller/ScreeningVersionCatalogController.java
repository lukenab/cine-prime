package movieservice.controller;

import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.response.MovieScreeningVersionCatalogResponse;
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
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<MovieScreeningVersionCatalogResponse>> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) ScreeningVersionStatus status,
            @RequestParam(required = false) Integer formatId,
            @RequestParam(defaultValue = "false") boolean attentionOnly
    ) {
        return ApiResponse.<List<MovieScreeningVersionCatalogResponse>>builder()
                .code(HttpStatus.OK.value())
                .result(screeningVersionService.searchCatalog(q, status, formatId, attentionOnly))
                .build();
    }
}
