package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.RejectRequest;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.dto.response.ImageUploadResponse;
import movieservice.dto.response.MovieResponse;
import movieservice.dto.response.MovieStatusHistoryResponse;
import movieservice.dto.response.PublicMovieResponse;
import movieservice.enums.MovieStatus;
import movieservice.service.MovieService;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

/**
 * Movie content-lifecycle endpoints. See
 * docs/api-specs/movie-service/MOVIE_LIFECYCLE_CONTRACT.md — this controller
 * only ever moves Movie.status (content review). Exhibition/availability
 * commands (open/suspend/resume/close) live on MovieAvailabilityController.
 */
@RestController
@RequestMapping("/api/movies")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieController {

    MovieService movieService;

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_CREATE')")
    @PostMapping
    public ApiResponse<MovieResponse> createMovie(@Valid @RequestBody CreateMovieRequest request) {
        String actor = SecurityContextHolder.getContext().getAuthentication().getName();
        return ApiResponse.<MovieResponse>builder()
                .code(200)
                .result(movieService.createMovie(request, actor))
                .build();
    }

    /** Internal catalog detail - exposes full workflow state (rejectionNote, audit fields via
     *  MovieResponse) so it must never be reachable by guessing an ID as a customer/anonymous
     *  caller. Public detail is the separate GET /api/movies/public/{id} below. */
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_READ')")
    @GetMapping("/{id}")
    public ApiResponse<MovieResponse> findById(
            @PathVariable Long id,
            @RequestParam(required = false) String lang) {
        return ApiResponse.<MovieResponse>builder()
                .code(200)
                .result(lang != null ? movieService.getMovieByLang(id, lang) : movieService.getMovie(id))
                .build();
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_READ')")
    @GetMapping("/{id}/status-history")
    public ApiResponse<List<MovieStatusHistoryResponse>> getStatusHistory(@PathVariable Long id) {
        return ApiResponse.<List<MovieStatusHistoryResponse>>builder()
                .code(200)
                .result(movieService.getMovieStatusHistory(id))
                .build();
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_READ')")
    @GetMapping
    public ApiResponse<Page<MovieResponse>> getPage(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) MovieStatus status,
            @RequestParam(required = false) Long genreId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.<Page<MovieResponse>>builder()
                .code(200)
                .result(movieService.findPageWithFilters(page - 1, size, q, status, genreId, date))
                .build();
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_READ')")
    @GetMapping("/all")
    public ApiResponse<List<MovieResponse>> getAll() {
        return ApiResponse.<List<MovieResponse>>builder()
                .code(200)
                .result(movieService.findAll())
                .build();
    }

    /** MOV-LC-07: displayStatus is derived per cluster, not from Movie.status. */
    @GetMapping("/public")
    public ApiResponse<List<PublicMovieResponse>> getPublic(@RequestParam(required = false) Long clusterId) {
        return ApiResponse.<List<PublicMovieResponse>>builder()
                .code(200)
                .result(movieService.findAllPublic(clusterId))
                .build();
    }

    /** Public detail - same visibility predicate as getPublic() (MovieService.isPubliclyVisible).
     *  A DRAFT/PENDING_REVIEW/REJECTED/SUSPENDED/ENDED movie's ID returns the same
     *  MOVIE_NOT_FOUND (404) a nonexistent ID would, never a response that reveals it exists. */
    @GetMapping("/public/{id}")
    public ApiResponse<PublicMovieResponse> getPublicById(
            @PathVariable Long id,
            @RequestParam(required = false) Long clusterId) {
        return ApiResponse.<PublicMovieResponse>builder()
                .code(200)
                .result(movieService.getPublicMovieDetail(id, clusterId))
                .build();
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_UPDATE')")
    @PutMapping("/{id}")
    public ApiResponse<MovieResponse> updateMovie(@PathVariable Long id,
            @Valid @RequestBody UpdateMovieRequest request) {
        return ApiResponse.<MovieResponse>builder()
                .code(200)
                .message("Movie updated successfully")
                .result(movieService.updateMovie(id, request))
                .build();
    }

    /** DRAFT → PENDING_REVIEW */
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_SUBMIT')")
    @PostMapping("/{id}/submit")
    public ApiResponse<MovieResponse> submit(@PathVariable Long id) {
        String updatedBy = SecurityContextHolder.getContext().getAuthentication().getName();
        return ApiResponse.<MovieResponse>builder()
                .code(200).message("Submitted for review")
                .result(movieService.submitForReview(id, updatedBy))
                .build();
    }

    /** PENDING_REVIEW → APPROVED. Content-only — does not publish or open sales anywhere. */
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_APPROVE')")
    @PostMapping("/{id}/approve")
    public ApiResponse<MovieResponse> approve(@PathVariable Long id) {
        String updatedBy = SecurityContextHolder.getContext().getAuthentication().getName();
        return ApiResponse.<MovieResponse>builder()
                .code(200).message("Movie approved")
                .result(movieService.approveMovie(id, updatedBy))
                .build();
    }

    /** PENDING_REVIEW → CHANGES_REQUESTED */
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_APPROVE')")
    @PostMapping("/{id}/request-changes")
    public ApiResponse<MovieResponse> requestChanges(@PathVariable Long id,
            @Valid @RequestBody RejectRequest request) {
        String updatedBy = SecurityContextHolder.getContext().getAuthentication().getName();
        return ApiResponse.<MovieResponse>builder()
                .code(200).message("Changes requested")
                .result(movieService.requestChanges(id, request.getNote(), updatedBy))
                .build();
    }

    /** CHANGES_REQUESTED → DRAFT */
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_UPDATE')")
    @PostMapping("/{id}/start-revision")
    public ApiResponse<MovieResponse> startRevision(@PathVariable Long id) {
        String updatedBy = SecurityContextHolder.getContext().getAuthentication().getName();
        return ApiResponse.<MovieResponse>builder()
                .code(200).message("Movie moved back to Draft for revision")
                .result(movieService.startRevision(id, updatedBy))
                .build();
    }

    /** APPROVED → ARCHIVED. Blocked while any availability window is PLANNED/OPEN. */
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_APPROVE')")
    @PostMapping("/{id}/archive")
    public ApiResponse<MovieResponse> archive(@PathVariable Long id) {
        String updatedBy = SecurityContextHolder.getContext().getAuthentication().getName();
        return ApiResponse.<MovieResponse>builder()
                .code(200).message("Movie archived")
                .result(movieService.archiveMovie(id, updatedBy))
                .build();
    }

    // ── Image upload ──────────────────────────────────────────

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_UPDATE')")
    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ImageUploadResponse> uploadImage(@RequestParam("file") MultipartFile file) {
        return ApiResponse.<ImageUploadResponse>builder()
                .code(200)
                .message("Image uploaded successfully")
                .result(movieService.uploadMovieImage(file))
                .build();
    }
}
