package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.RejectRequest;
import movieservice.dto.request.SuspendRequest;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.dto.response.ImageUploadResponse;
import movieservice.dto.response.MovieResponse;
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

@RestController
@RequestMapping("/api/movies")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieController {

    MovieService movieService;

    @PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")
    @PostMapping
    public ApiResponse<MovieResponse> createMovie(@Valid @RequestBody CreateMovieRequest request) {
        return ApiResponse.<MovieResponse>builder()
                .code(200)
                .result(movieService.createMovie(request))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<MovieResponse> findById(
            @PathVariable Long id,
            @RequestParam(required = false) String lang) {
        return ApiResponse.<MovieResponse>builder()
                .code(200)
                .result(lang != null ? movieService.getMovieByLang(id, lang) : movieService.getMovie(id))
                .build();
    }

    @GetMapping
    public ApiResponse<Page<MovieResponse>> getPage(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) MovieStatus status,
            @RequestParam(required = false) Long genreId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.<Page<MovieResponse>>builder()
                .code(200)
                .result(movieService.findPageWithFilters(page - 1, size, status, genreId, date))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")
    @GetMapping("/all")
    public ApiResponse<List<MovieResponse>> getAll() {
        return ApiResponse.<List<MovieResponse>>builder()
                .code(200)
                .result(movieService.findAll())
                .build();
    }

    @GetMapping("/public")
    public ApiResponse<List<MovieResponse>> getPublic() {
        return ApiResponse.<List<MovieResponse>>builder()
                .code(200)
                .result(movieService.findAllPublic())
                .build();
    }

    @PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")
    @PutMapping("/{id}")
    public ApiResponse<MovieResponse> updateMovie(@PathVariable Long id,
            @Valid @RequestBody UpdateMovieRequest request) {
        return ApiResponse.<MovieResponse>builder()
                .code(200)
                .message("Movie updated successfully")
                .result(movieService.updateMovie(id, request))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteMovie(@PathVariable Long id) {
        movieService.deleteMovie(id);
        return ApiResponse.<Void>builder()
                .code(200)
                .message("Movie deleted successfully")
                .build();
    }


    /** DRAFT → PENDING_REVIEW */
    @PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")
    @PostMapping("/{id}/submit")
    public ApiResponse<Void> submit(@PathVariable Long id) {
        String updatedBy = SecurityContextHolder.getContext().getAuthentication().getName();
        movieService.submitForReview(id, updatedBy);
        return ApiResponse.<Void>builder().code(200).message("Submitted for review").build();
    }

    /** PENDING_REVIEW → COMING_SOON */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/approve")
    public ApiResponse<Void> approve(@PathVariable Long id) {
        String updatedBy = SecurityContextHolder.getContext().getAuthentication().getName();
        movieService.approveMovie(id, updatedBy);
        return ApiResponse.<Void>builder().code(200).message("Movie approved").build();
    }

    /** PENDING_REVIEW → REJECTED */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/reject")
    public ApiResponse<Void> reject(@PathVariable Long id,
            @Valid @RequestBody RejectRequest request) {
        String updatedBy = SecurityContextHolder.getContext().getAuthentication().getName();
        movieService.rejectMovie(id, request.getNote(), updatedBy);
        return ApiResponse.<Void>builder().code(200).message("Movie rejected").build();
    }

    /** NOW_SHOWING | COMING_SOON → SUSPENDED */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/suspend")
    public ApiResponse<Void> suspend(@PathVariable Long id,
            @Valid @RequestBody SuspendRequest request) {
        String updatedBy = SecurityContextHolder.getContext().getAuthentication().getName();
        movieService.suspendMovie(id, request.getReason(), updatedBy);
        return ApiResponse.<Void>builder().code(200).message("Movie suspended").build();
    }

    /** COMING_SOON | NOW_SHOWING | SUSPENDED → ENDED */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/end")
    public ApiResponse<Void> end(@PathVariable Long id) {
        String updatedBy = SecurityContextHolder.getContext().getAuthentication().getName();
        movieService.endMovie(id, updatedBy);
        return ApiResponse.<Void>builder().code(200).message("Movie ended").build();
    }

    /** REJECTED → DRAFT: employee chỉnh sửa lại */
    @PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")
    @PostMapping("/{id}/rework")
    public ApiResponse<Void> rework(@PathVariable Long id) {
        String updatedBy = SecurityContextHolder.getContext().getAuthentication().getName();
        movieService.reworkMovie(id, updatedBy);
        return ApiResponse.<Void>builder().code(200).message("Movie moved back to Draft for rework").build();
    }

    /** COMING_SOON → NOW_SHOWING: admin mở bán vé */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/release")
    public ApiResponse<Void> release(@PathVariable Long id) {
        String updatedBy = SecurityContextHolder.getContext().getAuthentication().getName();
        movieService.releaseMovie(id, updatedBy);
        return ApiResponse.<Void>builder().code(200).message("Movie is now showing").build();
    }

    /** SUSPENDED → NOW_SHOWING: admin phục hồi sau sự cố */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/reinstate")
    public ApiResponse<Void> reinstate(@PathVariable Long id) {
        String updatedBy = SecurityContextHolder.getContext().getAuthentication().getName();
        movieService.reinstateMovie(id, updatedBy);
        return ApiResponse.<Void>builder().code(200).message("Movie reinstated to Now Showing").build();
    }

    // ── Image upload ──────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")
    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ImageUploadResponse> uploadImage(@RequestParam("file") MultipartFile file) {
        return ApiResponse.<ImageUploadResponse>builder()
                .code(200)
                .message("Image uploaded successfully")
                .result(movieService.uploadMovieImage(file))
                .build();
    }
}
