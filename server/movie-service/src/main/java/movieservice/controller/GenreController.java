package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.GenreRequest;
import movieservice.dto.response.GenreResponse;
import movieservice.service.GenreService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/genres")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class GenreController {

    GenreService genreService;

    @GetMapping
    public ApiResponse<List<GenreResponse>> getAll() {
        return ApiResponse.<List<GenreResponse>>builder()
                .code(200)
                .result(genreService.getAll())
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<GenreResponse> getById(@PathVariable Long id) {
        return ApiResponse.<GenreResponse>builder()
                .code(200)
                .result(genreService.getById(id))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ApiResponse<GenreResponse> create(@Valid @RequestBody GenreRequest request) {
        return ApiResponse.<GenreResponse>builder()
                .code(201)
                .result(genreService.create(request.getGenreName()))
                .build();
    }
}
