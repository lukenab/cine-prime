package movieservice.controller;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.apache.catalina.startup.ClassLoaderFactory.Repository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movieservice.exception.ResponseWrapper;
import movieservice.service.MovieService;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.TypeRequest;
import movieservice.dto.response.MovieResponse;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/movie")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieController {
    private MovieService movieService;
    @PostMapping("/create")
    public movieservice.dto.response.ApiResponse<?> createMovie(
            @Valid @RequestBody CreateMovieRequest createMovieRequest) {
        return movieService.createMovie(createMovieRequest);
    }
    @GetMapping("/find/{id}")
    public movieservice.dto.response.ApiResponse<?> getMethodName(@PathVariable("id") String movieId) {
        return movieService.getMovie(movieId);
    }


    @GetMapping("/find-all")
    public ResponseEntity<movieservice.dto.response.ApiResponse<List<MovieResponse>>> getAllMovies() {
        return movieService.findAll();
    }


    @PostMapping("/create-room")
    public ResponseEntity<movieservice.dto.response.ApiResponse<?>> createTypeRoom(
            @RequestBody CinemaRoomRequest cinemaRoomRequest) {
        return movieService.createCinemaRoom(cinemaRoomRequest);

    }
    @PostMapping("/create-type")
    public ResponseEntity<movieservice.dto.response.ApiResponse<?>> createTypeMovie(
            @RequestBody TypeRequest typeRequest) {
        return movieService.createTypeMovie(typeRequest);

    }

}
