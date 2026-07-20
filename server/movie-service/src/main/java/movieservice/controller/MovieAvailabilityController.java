package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.CloseRequest;
import movieservice.dto.request.CreateMovieAvailabilityRequest;
import movieservice.dto.request.SuspendRequest;
import movieservice.dto.request.UpdateMovieAvailabilityRequest;
import movieservice.dto.response.MovieAvailabilityResponse;
import movieservice.enums.AvailabilityStatus;
import movieservice.service.MovieAvailabilityService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Cluster-scoped exhibition/release-plan commands (MOV-LC-06). Never touches Movie.status. */
@RestController
@RequestMapping("/api/movie-availabilities")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieAvailabilityController {

    MovieAvailabilityService movieAvailabilityService;

    @PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")
    @GetMapping
    public ApiResponse<List<MovieAvailabilityResponse>> search(
            @RequestParam(required = false) Long movieId,
            @RequestParam(required = false) Long clusterId,
            @RequestParam(required = false) AvailabilityStatus status) {
        return ApiResponse.<List<MovieAvailabilityResponse>>builder()
                .code(200)
                .result(movieAvailabilityService.search(movieId, clusterId, status))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")
    @PostMapping
    public ApiResponse<MovieAvailabilityResponse> create(@Valid @RequestBody CreateMovieAvailabilityRequest request) {
        return ApiResponse.<MovieAvailabilityResponse>builder()
                .code(200)
                .result(movieAvailabilityService.create(request, actor()))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")
    @PutMapping("/{id}")
    public ApiResponse<MovieAvailabilityResponse> update(@PathVariable Long id,
            @RequestBody UpdateMovieAvailabilityRequest request) {
        return ApiResponse.<MovieAvailabilityResponse>builder()
                .code(200)
                .result(movieAvailabilityService.update(id, request, actor()))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/open")
    public ApiResponse<MovieAvailabilityResponse> open(@PathVariable Long id) {
        return ApiResponse.<MovieAvailabilityResponse>builder()
                .code(200).message("Availability opened")
                .result(movieAvailabilityService.open(id, actor()))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/suspend")
    public ApiResponse<MovieAvailabilityResponse> suspend(@PathVariable Long id,
            @Valid @RequestBody SuspendRequest request) {
        return ApiResponse.<MovieAvailabilityResponse>builder()
                .code(200).message("Availability suspended")
                .result(movieAvailabilityService.suspend(id, request.getReason(), actor()))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/resume")
    public ApiResponse<MovieAvailabilityResponse> resume(@PathVariable Long id) {
        return ApiResponse.<MovieAvailabilityResponse>builder()
                .code(200).message("Availability resumed")
                .result(movieAvailabilityService.resume(id, actor()))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/close")
    public ApiResponse<MovieAvailabilityResponse> close(
            @PathVariable Long id,
            @RequestBody(required = false) CloseRequest request) {
        String reason = request != null ? request.getReason() : null;
        return ApiResponse.<MovieAvailabilityResponse>builder()
                .code(200).message("Availability closed")
                .result(movieAvailabilityService.close(id, reason, actor()))
                .build();
    }

    private String actor() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }
}
