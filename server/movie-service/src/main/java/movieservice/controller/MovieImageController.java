package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.MovieImageRequest;
import movieservice.dto.response.MovieImageResponse;
import movieservice.entity.Movie;
import movieservice.entity.MovieImage;
import movieservice.mapper.MovieMapper;
import movieservice.repository.MovieImageRepository;
import movieservice.repository.MovieRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/movies/{movieId}/images")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieImageController {

    MovieRepository movieRepository;
    MovieImageRepository movieImageRepository;
    MovieMapper movieMapper;

    // GET /api/movies/{movieId}/images
    @GetMapping
    public ApiResponse<List<MovieImageResponse>> getImages(@PathVariable Long movieId) {
        requireMovie(movieId);
        List<MovieImage> images = movieImageRepository
                .findByMovie_MovieIdOrderByDisplayOrderAscImageIdAsc(movieId);
        return ApiResponse.<List<MovieImageResponse>>builder()
                .code(200)
                .result(movieMapper.toMovieImageResponseList(images))
                .build();
    }

    // POST /api/movies/{movieId}/images
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<MovieImageResponse> addImage(
            @PathVariable Long movieId,
            @Valid @RequestBody MovieImageRequest request) {
        Movie movie = requireMovie(movieId);
        MovieImage image = MovieImage.builder()
                .movie(movie)
                .imageUrl(request.getImageUrl())
                .imageType(request.getImageType() != null ? request.getImageType() : "STILL")
                .displayOrder(request.getDisplayOrder())
                .caption(request.getCaption())
                .build();
        image = movieImageRepository.save(image);
        return ApiResponse.<MovieImageResponse>builder()
                .code(201)
                .result(movieMapper.toMovieImageResponse(image))
                .build();
    }

    // DELETE /api/movies/{movieId}/images/{imageId}
    @DeleteMapping("/{imageId}")
    public ApiResponse<Void> deleteImage(
            @PathVariable Long movieId,
            @PathVariable Long imageId) {
        requireMovie(movieId);
        MovieImage image = movieImageRepository.findById(imageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found"));
        if (!image.getMovie().getMovieId().equals(movieId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image does not belong to this movie");
        }
        movieImageRepository.delete(image);
        return ApiResponse.<Void>builder()
                .code(200)
                .message("Deleted successfully")
                .build();
    }

    private Movie requireMovie(Long movieId) {
        return movieRepository.findById(movieId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Movie not found"));
    }
}
