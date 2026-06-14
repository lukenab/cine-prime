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
@Tag(name = "Movie Controller", description = "APIs for managing movies in the Cinema system")
public class MovieController {
    private MovieService movieService;

    @Operation(summary = "Tạo phim mới", description = "API tạo phim và lịch chiếu")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Tạo movie thành công", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"200\", \"message\": \"Tạo movie thành công\", \"status\": \"OK\"}"))),
            @ApiResponse(responseCode = "400", description = "Dữ liệu yêu cầu không hợp lệ", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"400\", \"message\": \"Tên phim tiếng Việt không được để trống; Đạo diễn không được để trống\", \"status\": \"BAD_REQUEST\"}"))),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy tài nguyên", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"404\", \"message\": \"Không tìm thấy thể loại với ID\", \"status\": \"NOT_FOUND\"}"))),
            @ApiResponse(responseCode = "900", description = "Dữ liệu yêu cầu không hợp lệ", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"900\", \"message\": \"Giờ chiếu không hợp lệ! Rạp chỉ hoạt động trong khoảng từ 8h đến 23h\", \"status\": \"INTERNAL_SERVER_ERROR\"}"))),
            @ApiResponse(responseCode = "901", description = "Xung đột dữ liệu", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"901\", \"message\": \"Lỗi có lịch phim đã tồn tại trong phòng\", \"status\": \"CONFLICT\"}"))),
            @ApiResponse(responseCode = "902", description = "Dữ liệu yêu cầu không hợp lệ", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"902\", \"message\": \"Ngày chiếu không hợp lệ! Chỉ được đăng ký lịch chiếu tối thiểu 3 ngày sau tính từ hôm nay.\", \"status\": \"INTERNAL_SERVER_ERROR\"}"))),
            @ApiResponse(responseCode = "903", description = "Lỗi có lịch phim đã tồn tại", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"903\", \"message\": \"Phòng đã có lịch chiếu khác.\", \"status\": \"INTERNAL_SERVER_ERROR\"}"))),
            @ApiResponse(responseCode = "904", description = "Không tìm thấy tài nguyên", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"904\", \"message\": \"Phòng không tồn tại.\", \"status\": \"INTERNAL_SERVER_ERROR\"}")))
    })
    @PostMapping("/create")
    public movieservice.dto.response.ApiResponse<?> createMovie(
            @Valid @RequestBody CreateMovieRequest createMovieRequest) {
        return movieService.createMovie(createMovieRequest);
    }

    @Operation(summary = "Lấy phim theo ID", description = "Trả về đối tượng Movie nếu tồn tại")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "OK", content = @Content(mediaType = "application/json", schema = @Schema(implementation = movieservice.exception.ResponseWrapper.class), examples = @ExampleObject(value = "{\"code\": \"200\", \"message\": \"Lấy movie thành công\", \"status\": \"OK\", \"data\": {\"movieId\": 1, \"movieNameVn\": \"One Piece Film Red\", \"movieNameEnglish\": \"One Piece Film Red\", \"director\": \"Goro Taniguchi\", \"actor\": \"Luffy, Uta\", \"duration\": 115, \"content\": \"Câu chuyện...\", \"version\": \"2D\", \"status\": true}}"))),
            @ApiResponse(responseCode = "400", description = "Dữ liệu yêu cầu không hợp lệ", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"400\", \"message\": \"lỗi dữ liệu không hợp lệ\", \"status\": \"BAD_REQUEST\"}"))),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy tài nguyên", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"404\", \"message\": \"Không tìm thầy movie phù hợp\", \"status\": \"NOT_FOUND\"}")))
    })
    @GetMapping("/find/{id}")
    public movieservice.dto.response.ApiResponse<?> getMethodName(@PathVariable("id") String movieId) {
        return movieService.getMovie(movieId);
    }

    @Operation(summary = "Lấy tất cả phim", description = "Trả về danh sách Movie nếu tồn tại")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "OK", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\":200,\"message\":\"Lấy danh sách phim thành công\",\"result\":[{\"movieId\":1,\"actor\":\"Robert Downey Jr., Chris Evans, Scarlett Johansson\",\"content\":\"Sau sự kiện Infinity War, các siêu anh hùng còn sống sót tìm cách đảo ngược hậu quả do Thanos gây ra.\",\"director\":\"Anthony Russo, Joe Russo\",\"duration\":181,\"movieProductionCompany\":\"Marvel Studios\",\"version\":\"2D\",\"movieNameEnglish\":\"Avengers: Endgame\",\"movieNameVn\":\"Avengers: Hồi Kết\",\"largeImage\":\"https://example.com/images/avengers-large.jpg\",\"smallImage\":\"https://example.com/images/avengers-small.jpg\",\"status\":true,\"movieConnects\":[\"Hành động\"],\"showTimes\":[{\"showTimeId\":1,\"showDate\":\"2026-11-30\",\"startTime\":\"08:00:00\",\"endTime\":\"11:01:00\",\"updateAt\":null},{\"showTimeId\":2,\"showDate\":\"2026-10-30\",\"startTime\":\"08:00:00\",\"endTime\":\"11:01:00\",\"updateAt\":null}],\"createAt\":\"2026-06-15T02:51:46.966967\"}]}"))),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy tài nguyên", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"404\", \"message\": \"Không tìm thầy movie phù hợp\", \"status\": \"NOT_FOUND\"}")))
    })
    @GetMapping("/find-all")
    public ResponseEntity<movieservice.dto.response.ApiResponse<List<MovieResponse>>> getAllMovies() {
        return movieService.findAll();
    }

    @Operation(summary = "Tạo room cinema", description = "Trả về trạng thái thành công")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Tạo room cinema", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"200\", \"message\": \"Tạo Room Cinema thành công\", \"status\": \"OK\"}"))),
            @ApiResponse(responseCode = "409", description = "Xung đột dữ liệu", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"409\", \"message\": \"Tên phòng đã tồn tại!!!\", \"status\": \"CONFLICT\"}")))
    })
    @PostMapping("/create-room")
    public ResponseEntity<movieservice.dto.response.ApiResponse<?>> createTypeRoom(
            @RequestBody CinemaRoomRequest cinemaRoomRequest) {
        return movieService.createCinemaRoom(cinemaRoomRequest);

    }

    @Operation(summary = "Tạo loại phim", description = "Trả về trạng thái thành công")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Tạo loại phim", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"200\", \"message\": \"Tạo loại phim thành công\", \"status\": \"OK\"}"))),
            @ApiResponse(responseCode = "409", description = "Xung đột dữ liệu", content = @Content(mediaType = "application/json", examples = @ExampleObject(value = "{\"code\": \"409\", \"message\": \"Tên loại phim đã tồn tại!!!\", \"status\": \"CONFLICT\"}")))
    })
    @PostMapping("/create-type")
    public ResponseEntity<movieservice.dto.response.ApiResponse<?>> createTypeMovie(
            @RequestBody TypeRequest typeRequest) {
        return movieService.createTypeMovie(typeRequest);

    }

}
