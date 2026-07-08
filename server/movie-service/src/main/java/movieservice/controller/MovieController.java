package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.dto.response.ImageUploadResponse;
import movieservice.dto.response.MovieResponse;
import movieservice.service.MovieService;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/movies")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieController {

    MovieService movieService;

    // ── CRUD ──────────────────────────────────────────────────

    @PostMapping
    public ApiResponse<MovieResponse> createMovie(@Valid @RequestBody CreateMovieRequest request) {
        return ApiResponse.<MovieResponse>builder()
                .code(200)
                .result(movieService.createMovie(request))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<MovieResponse> findById(@PathVariable Long id) {
        return ApiResponse.<MovieResponse>builder()
                .code(200)
                .result(movieService.getMovie(id))
                .build();
    }

    @GetMapping
    public ApiResponse<Page<MovieResponse>> getPage(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.<Page<MovieResponse>>builder()
                .code(200)
                .result(movieService.findPage(page - 1, size))
                .build();
    }

    /** Admin: returns all movies regardless of status */
    @GetMapping("/all")
    public ApiResponse<List<MovieResponse>> getAll() {
        return ApiResponse.<List<MovieResponse>>builder()
                .code(200)
                .result(movieService.findAll())
                .build();
    }

    /** Public: only COMING_SOON / NOW_SHOWING */
    @GetMapping("/public")
    public ApiResponse<List<MovieResponse>> getPublic() {
        return ApiResponse.<List<MovieResponse>>builder()
                .code(200)
                .result(movieService.findAllPublic())
                .build();
    }

    @PutMapping("/{id}")
    public ApiResponse<MovieResponse> updateMovie(@PathVariable Long id,
            @Valid @RequestBody UpdateMovieRequest request) {
        return ApiResponse.<MovieResponse>builder()
                .code(200)
                .message("Movie updated successfully")
                .result(movieService.updateMovie(id, request))
                .build();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteMovie(@PathVariable Long id) {
        movieService.deleteMovie(id);
        return ApiResponse.<Void>builder()
                .code(200)
                .message("Movie deleted successfully")
                .build();
    }

    // ── Status transitions ────────────────────────────────────

    /** DRAFT → PENDING_REVIEW */
    @PostMapping("/{id}/submit")
    public ApiResponse<Void> submit(@PathVariable Long id,
            @RequestHeader(value = "X-User-Name", defaultValue = "unknown") String updatedBy) {
        movieService.submitForReview(id, updatedBy);
        return ApiResponse.<Void>builder().code(200).message("Submitted for review").build();
    }

    /** PENDING_REVIEW → COMING_SOON */
    @PostMapping("/{id}/approve")
    public ApiResponse<Void> approve(@PathVariable Long id,
            @RequestHeader(value = "X-User-Name", defaultValue = "unknown") String updatedBy) {
        movieService.approveMovie(id, updatedBy);
        return ApiResponse.<Void>builder().code(200).message("Movie approved").build();
    }

    /** PENDING_REVIEW → REJECTED */
    @PostMapping("/{id}/reject")
    public ApiResponse<Void> reject(@PathVariable Long id,
            @RequestParam String note,
            @RequestHeader(value = "X-User-Name", defaultValue = "unknown") String updatedBy) {
        movieService.rejectMovie(id, note, updatedBy);
        return ApiResponse.<Void>builder().code(200).message("Movie rejected").build();
    }

    /** NOW_SHOWING | COMING_SOON → SUSPENDED */
    @PostMapping("/{id}/suspend")
    public ApiResponse<Void> suspend(@PathVariable Long id,
            @RequestParam String reason,
            @RequestHeader(value = "X-User-Name", defaultValue = "unknown") String updatedBy) {
        movieService.suspendMovie(id, reason, updatedBy);
        return ApiResponse.<Void>builder().code(200).message("Movie suspended").build();
    }

    // ── Image upload ──────────────────────────────────────────

    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ImageUploadResponse> uploadImage(@RequestParam("file") MultipartFile file) {
        return ApiResponse.<ImageUploadResponse>builder()
                .code(200)
                .message("Image uploaded successfully")
                .result(movieService.uploadMovieImage(file))
                .build();
    }
}
