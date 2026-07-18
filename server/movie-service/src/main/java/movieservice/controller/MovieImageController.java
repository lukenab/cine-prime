package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.MovieImageRequest;
import movieservice.dto.request.TmdbImageImportRequest;
import movieservice.dto.response.MovieImageResponse;
import movieservice.dto.response.TmdbImageImportResponse;
import movieservice.service.MovieImageService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/movies/{movieId}/images")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieImageController {

    MovieImageService movieImageService;

    // GET /api/movies/{movieId}/images
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @GetMapping
    public ApiResponse<List<MovieImageResponse>> getImages(@PathVariable Long movieId) {
        return ApiResponse.<List<MovieImageResponse>>builder()
                .code(200)
                .result(movieImageService.getImages(movieId))
                .build();
    }

    // POST /api/movies/{movieId}/images
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<MovieImageResponse> addImage(
            @PathVariable Long movieId,
            @Valid @RequestBody MovieImageRequest request) {
        return ApiResponse.<MovieImageResponse>builder()
                .code(201)
                .result(movieImageService.addImage(movieId, request))
                .build();
    }

    // POST /api/movies/{movieId}/images/tmdb-import — TMDB-FIX-05: selective poster/backdrop/still import
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PostMapping("/tmdb-import")
    public ApiResponse<TmdbImageImportResponse> importFromTmdb(
            @PathVariable Long movieId,
            @Valid @RequestBody TmdbImageImportRequest request) {
        return ApiResponse.<TmdbImageImportResponse>builder()
                .code(200)
                .result(movieImageService.importFromTmdb(movieId, request))
                .build();
    }

    // DELETE /api/movies/{movieId}/images/{imageId}
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @DeleteMapping("/{imageId}")
    public ApiResponse<Void> deleteImage(
            @PathVariable Long movieId,
            @PathVariable Long imageId) {
        movieImageService.deleteImage(movieId, imageId);
        return ApiResponse.<Void>builder()
                .code(200)
                .message("Deleted successfully")
                .build();
    }
}
