package movieservice.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.MovieScreeningVersionRequest;
import movieservice.dto.response.MovieScreeningVersionResponse;
import movieservice.service.MovieScreeningVersionService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/movies/{movieId}/screening-versions")
@RequiredArgsConstructor
public class MovieScreeningVersionController {

    private final MovieScreeningVersionService screeningVersionService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_READ')")
    public ApiResponse<List<MovieScreeningVersionResponse>> list(@PathVariable Long movieId) {
        return ApiResponse.<List<MovieScreeningVersionResponse>>builder()
                .code(HttpStatus.OK.value())
                .result(screeningVersionService.list(movieId))
                .build();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_UPDATE')")
    public ApiResponse<MovieScreeningVersionResponse> create(
            @PathVariable Long movieId,
            @Valid @RequestBody MovieScreeningVersionRequest request
    ) {
        return ApiResponse.<MovieScreeningVersionResponse>builder()
                .code(HttpStatus.CREATED.value())
                .message("Screening version created")
                .result(screeningVersionService.create(movieId, request))
                .build();
    }

    @PostMapping("/batch")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_UPDATE')")
    public ApiResponse<List<MovieScreeningVersionResponse>> createBulk(
            @PathVariable Long movieId,
            @Valid @RequestBody
            @NotEmpty(message = "At least one screening version is required")
            @Size(max = 10, message = "At most 10 screening versions can be created at once")
            List<@Valid MovieScreeningVersionRequest> requests
    ) {
        return ApiResponse.<List<MovieScreeningVersionResponse>>builder()
                .code(HttpStatus.CREATED.value())
                .message("Screening versions created")
                .result(screeningVersionService.createBulk(movieId, requests))
                .build();
    }

    @PutMapping("/{versionId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_UPDATE')")
    public ApiResponse<MovieScreeningVersionResponse> update(
            @PathVariable Long movieId,
            @PathVariable Long versionId,
            @Valid @RequestBody MovieScreeningVersionRequest request
    ) {
        return ApiResponse.<MovieScreeningVersionResponse>builder()
                .code(HttpStatus.OK.value())
                .message("Screening version updated")
                .result(screeningVersionService.update(movieId, versionId, request))
                .build();
    }

    @PostMapping("/{versionId}/activate")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_UPDATE')")
    public ApiResponse<MovieScreeningVersionResponse> activate(
            @PathVariable Long movieId,
            @PathVariable Long versionId
    ) {
        return ApiResponse.<MovieScreeningVersionResponse>builder()
                .code(HttpStatus.OK.value())
                .message("Screening version activated")
                .result(screeningVersionService.activate(movieId, versionId))
                .build();
    }

    @PostMapping("/{versionId}/deactivate")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'MOVIE_UPDATE')")
    public ApiResponse<MovieScreeningVersionResponse> deactivate(
            @PathVariable Long movieId,
            @PathVariable Long versionId
    ) {
        return ApiResponse.<MovieScreeningVersionResponse>builder()
                .code(HttpStatus.OK.value())
                .message("Screening version deactivated")
                .result(screeningVersionService.deactivate(movieId, versionId))
                .build();
    }
}
