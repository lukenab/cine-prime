package movieservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.TmdbImportRequest;
import movieservice.dto.response.TmdbImportResponse;
import movieservice.dto.response.TmdbMovieDetailsResponse;
import movieservice.dto.response.TmdbSearchResultItem;
import movieservice.service.TmdbService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/movies/tmdb")
@RequiredArgsConstructor
public class TmdbController {

    private final TmdbService tmdbService;

    /** Tìm phim trên TMDB theo từ khoá */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/search")
    public ApiResponse<List<TmdbSearchResultItem>> search(@RequestParam String q) {
        return ApiResponse.<List<TmdbSearchResultItem>>builder()
                .code(200)
                .result(tmdbService.search(q))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{tmdbId}/details")
    public ApiResponse<TmdbMovieDetailsResponse> getDetails(@PathVariable Integer tmdbId) {
        return ApiResponse.<TmdbMovieDetailsResponse>builder()
                .code(200)
                .result(tmdbService.getDetails(tmdbId))
                .build();
    }

    /** Import phim từ TMDB vào DB với status=DRAFT */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/import")
    public ApiResponse<TmdbImportResponse> importMovie(@Valid @RequestBody TmdbImportRequest request) {
        return ApiResponse.<TmdbImportResponse>builder()
                .code(200)
                .result(tmdbService.importMovie(request.getTmdbId()))
                .build();
    }
}
