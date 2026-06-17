package movieservice.controller;

import java.util.List;

import org.apache.hc.core5.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.service.MovieService;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.TypeRequest;
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.dto.response.MovieResponse;
import movieservice.dto.response.TypeMovieResponse;
import movieservice.entity.CinemaRoom;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@RestController
@RequestMapping("/api/movie")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieController {
    private MovieService movieService;

    @PostMapping
    public ApiResponse<MovieResponse> createMovie(@Valid @RequestBody CreateMovieRequest createMovieRequest) {
        return ApiResponse.<MovieResponse>builder()
                .code(HttpStatus.SC_ACCEPTED)
                .result(movieService.createMovie(createMovieRequest))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<MovieResponse> findById(@PathVariable("id") Long movieId) {
        return ApiResponse.<MovieResponse>builder()
                .code(HttpStatus.SC_ACCEPTED)
                .result(movieService.getMovie(movieId))
                .build();
    }

    @GetMapping
    public ApiResponse<Page<MovieResponse>> getPageMovies(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.<Page<MovieResponse>>builder()
                .code(HttpStatus.SC_ACCEPTED)
                .result(movieService.findPageMovie(page - 1, size))
                .build();
    }

    @PostMapping("/room")
    public ApiResponse<CinemaRoomResponse> createTypeRoom(@Valid @RequestBody CinemaRoomRequest cinemaRoomRequest) {
        return ApiResponse.<CinemaRoomResponse>builder()
                .code(HttpStatus.SC_ACCEPTED)
                .result(movieService.createCinemaRoom(cinemaRoomRequest))
                .build();
    }

    @PostMapping("/type")
    public ApiResponse<TypeMovieResponse> createTypeMovie(@Valid @RequestBody TypeRequest typeRequest) {
        return ApiResponse.<TypeMovieResponse>builder()
                .code(HttpStatus.SC_ACCEPTED)
                .result(movieService.createTypeMovie(typeRequest))
                .build();
    }

}
