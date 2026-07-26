package movieservice.controller;

import jakarta.validation.Valid;
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
    @PreAuthorize("hasRole('ADMIN') or hasRole('EMPLOYEE')")
    public ApiResponse<List<MovieScreeningVersionResponse>> list(@PathVariable Long movieId) {
        return ApiResponse.<List<MovieScreeningVersionResponse>>builder()
                .code(HttpStatus.OK.value())
                .result(screeningVersionService.list(movieId))
                .build();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
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

    @PutMapping("/{versionId}")
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasRole('ADMIN')")
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
