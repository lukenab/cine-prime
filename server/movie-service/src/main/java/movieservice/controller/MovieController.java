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
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.response.MovieResponse;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.exception.ResourceNotFoundException;

import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;


@RestController
@RequestMapping("/api/movies")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Movie Controller", description = "APIs for managing movies in the Cinema system")
@ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Thành công (OK)"),
        @ApiResponse(responseCode = "400", description = "Dữ liệu yêu cầu không hợp lệ (Bad Request)"),
        @ApiResponse(responseCode = "404", description = "Không tìm thấy tài nguyên (Not Found)"),
        @ApiResponse(responseCode = "405", description = "Phương thức không được cho phép (Method Not Allowed)"),
        @ApiResponse(responseCode = "409", description = "Xung đột dữ liệu (Conflict)"),
        @ApiResponse(responseCode = "429", description = "Quá nhiều yêu cầu (Too Many Requests)"),
        @ApiResponse(responseCode = "500", description = "Lỗi máy chủ nội bộ (Internal Server Error)"),
        @ApiResponse(responseCode = "502", description = "Lỗi cổng kết nối (Bad Gateway)"),
        @ApiResponse(responseCode = "503", description = "Dịch vụ không khả dụng (Service Unavailable)")
})
public class MovieController {
    private MovieService movieService;

    @Operation(summary = "Tạo phim mới", description = "API tạo phim và lịch chiếu")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Tạo movie thành công", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"200\", \"message\": \"Tạo movie thành công\", \"status\": \"OK\", \"data\": null}"))),
            @ApiResponse(responseCode = "400", description = "Dữ liệu yêu cầu không hợp lệ", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"400\", \"message\": \"Tên phim tiếng Việt không được để trống; Đạo diễn không được để trống\", \"status\": \"BAD_REQUEST\", \"data\": null}"))),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy tài nguyên", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"404\", \"message\": \"Không tìm thấy thể loại với ID: 999\", \"status\": \"NOT_FOUND\", \"data\": null}"))),
            @ApiResponse(responseCode = "405", description = "Phương thức không được cho phép", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"405\", \"message\": \"Phương thức GET không được hỗ trợ\", \"status\": \"METHOD_NOT_ALLOWED\", \"data\": null}"))),
            @ApiResponse(responseCode = "409", description = "Xung đột dữ liệu", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"409\", \"message\": \"Phòng 1 đã có lịch chiếu khác trong khoảng 10:00 -> 12:00 vào ngày 15-06-2026\", \"status\": \"CONFLICT\", \"data\": null}"))),
            @ApiResponse(responseCode = "429", description = "Quá nhiều yêu cầu", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"429\", \"message\": \"Quá nhiều yêu cầu. Vui lòng thử lại sau 60 giây\", \"status\": \"TOO_MANY_REQUESTS\", \"data\": null}"))),
            @ApiResponse(responseCode = "500", description = "Lỗi máy chủ nội bộ", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"500\", \"message\": \"Lỗi database: connection timeout\", \"status\": \"INTERNAL_SERVER_ERROR\", \"data\": null}"))),
            @ApiResponse(responseCode = "502", description = "Lỗi cổng kết nối", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"502\", \"message\": \"Service khác không phản hồi\", \"status\": \"BAD_GATEWAY\", \"data\": null}"))),
            @ApiResponse(responseCode = "503", description = "Dịch vụ không khả dụng", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"503\", \"message\": \"Dịch vụ đang bảo trì\", \"status\": \"SERVICE_UNAVAILABLE\", \"data\": null}")))
    })
    @PostMapping("/create")
    public ResponseEntity<?> createMovie(@Valid @RequestBody CreateMovieRequest createMovieRequest) {
        return movieService.createMovie(createMovieRequest);
    }

    @Operation(summary = "Lấy phim theo ID", description = "Trả về đối tượng Movie nếu tồn tại")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "OK", content = @Content(mediaType = "application/json", schema = @Schema(implementation = movieservice.exception.ResponseWrapper.class), examples = @ExampleObject(value = "{\"code\": \"200\", \"message\": \"Lấy movie thành công\", \"status\": \"OK\", \"data\": {\"movieId\": 1, \"movieNameVn\": \"One Piece Film Red\", \"movieNameEnglish\": \"One Piece Film Red\", \"director\": \"Goro Taniguchi\", \"actor\": \"Luffy, Uta\", \"duration\": 115, \"content\": \"Câu chuyện...\", \"version\": \"2D\", \"status\": true}}"))),
            @ApiResponse(responseCode = "400", description = "Dữ liệu yêu cầu không hợp lệ", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"400\", \"message\": \"ID phim không hợp lệ\", \"status\": \"BAD_REQUEST\", \"data\": null}"))),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy tài nguyên", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"404\", \"message\": \"Không tìm thấy phim với ID: 999\", \"status\": \"NOT_FOUND\", \"data\": null}"))),
            @ApiResponse(responseCode = "405", description = "Phương thức không được cho phép", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"405\", \"message\": \"Phương thức POST không được hỗ trợ\", \"status\": \"METHOD_NOT_ALLOWED\", \"data\": null}"))),
            @ApiResponse(responseCode = "409", description = "Xung đột dữ liệu", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"409\", \"message\": \"Phòng chiếu đã có lịch chiếu khác\", \"status\": \"CONFLICT\", \"data\": null}"))),
            @ApiResponse(responseCode = "429", description = "Quá nhiều yêu cầu", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"429\", \"message\": \"Quá nhiều yêu cầu. Vui lòng thử lại sau 60 giây\", \"status\": \"TOO_MANY_REQUESTS\", \"data\": null}"))),
            @ApiResponse(responseCode = "500", description = "Lỗi máy chủ nội bộ", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"500\", \"message\": \"Lỗi database: connection timeout\", \"status\": \"INTERNAL_SERVER_ERROR\", \"data\": null}"))),
            @ApiResponse(responseCode = "502", description = "Lỗi cổng kết nối", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"502\", \"message\": \"Service khác không phản hồi\", \"status\": \"BAD_GATEWAY\", \"data\": null}"))),
            @ApiResponse(responseCode = "503", description = "Dịch vụ không khả dụng", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"503\", \"message\": \"Dịch vụ đang bảo trì\", \"status\": \"SERVICE_UNAVAILABLE\", \"data\": null}")))
    })
    @GetMapping("/find/{id}")
    public ResponseEntity<?> getMethodName(@PathVariable("id") Long movieId) {
        return movieService.getMovie(movieId);
    }

    @PutMapping("/{movieId}")
    public movie.theater.common.dto.ApiResponse<MovieResponse> updateMovie(@PathVariable("movieId") Long movieId, @Valid @RequestBody UpdateMovieRequest updateMovieRequest) {
        MovieResponse movieResponse = movieService.updateMovie(movieId, updateMovieRequest);
        return movie.theater.common.dto.ApiResponse.<MovieResponse>builder()
                .code(1000)
                .message("Movie successfully updated")
                .result(movieResponse)
                .build();
    }

    @DeleteMapping("/{movieId}")
    public movie.theater.common.dto.ApiResponse<Void> deleteMovie(@PathVariable("movieId") Long movieId) {
        movieService.deleteMovie(movieId);
        return movie.theater.common.dto.ApiResponse.<Void>builder()
                .code(1000)
                .message("Movie successfully deleted")
                .build();
    }

    @GetMapping("/find-all")
    public ResponseEntity<List<MovieResponse>> getAllMovies() {
        return ResponseEntity.ok(movieService.findAll());
    }

}
