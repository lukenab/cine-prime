package movieservice.controller;

import java.util.List;

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
import movieservice.dto.response.MovieResponse;

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
    public ApiResponse<?> createMovie(
            @Valid @RequestBody CreateMovieRequest createMovieRequest) {
        return movieService.createMovie(createMovieRequest);
    }

    @GetMapping("/{id}")
    public MovieResponse findById(@PathVariable("id") Long movieId) {
        return movieService.getMovie(movieId);
    }

    @GetMapping
    public ApiResponse<Page<MovieResponse>> getPageMovies(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return movieService.findPageMovie(page - 1, size);
    }

    @PostMapping("/room")
    public ApiResponse<?> createTypeRoom(@Valid
            @RequestBody CinemaRoomRequest cinemaRoomRequest) {
        return movieService.createCinemaRoom(cinemaRoomRequest);

    }

    @PostMapping("/type")
    public ApiResponse<?> createTypeMovie( @Valid
            @RequestBody TypeRequest typeRequest) {
        return movieService.createTypeMovie(typeRequest);

    }

}
