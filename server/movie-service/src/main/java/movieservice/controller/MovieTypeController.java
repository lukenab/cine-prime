package movieservice.controller;

import java.util.List;

import org.apache.hc.core5.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.TypeRequest;
import movieservice.dto.response.TypeMovieResponse;
import movieservice.service.MovieTypeService;

@RestController
@RequestMapping("/api/movie-type")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieTypeController {
    MovieTypeService movieTypeService;
    @GetMapping
    public ApiResponse<List<TypeMovieResponse>> getAllTypes() {
        
        return ApiResponse.<List<TypeMovieResponse>>builder()
                .code(HttpStatus.SC_OK)
                .result(movieTypeService.getAllTypes())
                .build();
    }

    

    @PostMapping
    public ApiResponse<TypeMovieResponse> createTypeMovie(@Valid @RequestBody TypeRequest typeRequest) {
        return ApiResponse.<TypeMovieResponse>builder()
                .code(HttpStatus.SC_OK)
                .result(movieTypeService.createTypeMovie(typeRequest))
                .build();
    }
}
