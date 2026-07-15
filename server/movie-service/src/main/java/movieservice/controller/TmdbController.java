package movieservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.TmdbImportRequest;
import movieservice.dto.response.TmdbGenreSyncResponse;
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

    /** Danh sach phim dang chieu rap (Now Playing) theo khu vuc - dung cho man hinh "Browse & Import" */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/now-playing")
    public ApiResponse<List<TmdbSearchResultItem>> nowPlaying(
            @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "1") int page) {
        return ApiResponse.<List<TmdbSearchResultItem>>builder()
                .code(200)
                .result(tmdbService.getNowPlaying(region, page))
                .build();
    }

    /** Danh sach phim sap ra mat (Upcoming) theo khu vuc - tab thu 2 cua man hinh "Browse & Import" */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/upcoming")
    public ApiResponse<List<TmdbSearchResultItem>> upcoming(
            @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "1") int page) {
        return ApiResponse.<List<TmdbSearchResultItem>>builder()
                .code(200)
                .result(tmdbService.getUpcoming(region, page))
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
                .result(tmdbService.importMovie(request))
                .build();
    }

    /** So sanh taxonomy genre cua TMDB voi mapping local, tra ve genre chua duoc map (read-only) */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/genres/sync")
    public ApiResponse<TmdbGenreSyncResponse> syncGenres() {
        return ApiResponse.<TmdbGenreSyncResponse>builder()
                .code(200)
                .result(tmdbService.syncGenres())
                .build();
    }
}
