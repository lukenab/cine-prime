package movieservice.controller;

import java.util.List;

import org.apache.hc.core5.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.service.MovieService;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.dto.response.ImageUploadResponse;
import movieservice.dto.response.MovieResponse;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;


@RestController
@RequestMapping("/api/movies")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieController {
     MovieService movieService;

    @PostMapping
    public ApiResponse<MovieResponse> createMovie(@Valid @RequestBody CreateMovieRequest createMovieRequest) {
        return ApiResponse.<MovieResponse>builder()
                .code(HttpStatus.SC_OK)
                .result(movieService.createMovie(createMovieRequest))
                .build();
    }

    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ImageUploadResponse> uploadMovieImage(@RequestParam("file") MultipartFile file) {
        return ApiResponse.<ImageUploadResponse>builder()
                .code(HttpStatus.SC_OK)
                .message("Image uploaded successfully")
                .result(movieService.uploadMovieImage(file))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<MovieResponse> findById(@PathVariable("id") Long movieId) {
        return ApiResponse.<MovieResponse>builder()
                .code(HttpStatus.SC_OK)
                .result(movieService.getMovie(movieId))
                .build();
    }

     @GetMapping
    public ApiResponse<Page<MovieResponse>> getPageMovies(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.<Page<MovieResponse>>builder()
                .code(HttpStatus.SC_OK)
                .result(movieService.findPageMovie(page - 1, size))
                .build();
    }

    @PutMapping("/{movieId}")
    public movie.theater.common.dto.ApiResponse<MovieResponse> updateMovie(@PathVariable("movieId") Long movieId,
            @Valid @RequestBody UpdateMovieRequest updateMovieRequest) {
        MovieResponse movieResponse = movieService.updateMovie(movieId, updateMovieRequest);
        return movie.theater.common.dto.ApiResponse.<MovieResponse>builder()
                .code(HttpStatus.SC_OK)
                .message("Movie successfully updated")
                .result(movieResponse)
                .build();
    }
    @DeleteMapping("/{movieId}")
    public movie.theater.common.dto.ApiResponse<Void> deleteMovie(@PathVariable("movieId") Long movieId) {
        movieService.deleteMovie(movieId);
        return movie.theater.common.dto.ApiResponse.<Void>builder()
                .code(HttpStatus.SC_OK)
                .message("Movie successfully deleted")
                .build();
    }

    @GetMapping("/all")
    public ApiResponse<List<MovieResponse>> getAllMovies() {
        return ApiResponse.<List<MovieResponse>>builder()
                .code(HttpStatus.SC_OK)
                .result(movieService.findAll())
                .build();
    }

    
    

}
