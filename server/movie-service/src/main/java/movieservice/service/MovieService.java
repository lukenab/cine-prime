package movieservice.service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.ShowTimeRequest;
import movieservice.dto.request.TypeRequest;
import movieservice.dto.response.ApiResponse;
import movieservice.dto.response.MovieResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.MovieConnect;
import movieservice.entity.MovieTypeId;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.entity.TypeMovie;
import movieservice.exception.ResponseWrapper;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieConnectRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.SeatRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.TypeMovieRepository;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieService {
    MovieRepository movieRepository;
    TypeMovieRepository typeRepository;
    ShowTimeRepository showTimeRepository;
    MovieMapper movieMapper;
    CinemaRoomRepository cinemaRoomRepository;
    MovieConnectRepository movieTypeRepository;
    SeatRepository seatRepository;

    @Transactional
    public movieservice.dto.response.ApiResponse<?> createMovie(CreateMovieRequest request) {
        try {
            Movie movie = movieMapper.toMovie(request);
            movieRepository.save(movie);
            List<ShowTimeRequest> showTimeRequests = request.getShowTimes();
            movieservice.dto.response.ApiResponse apiResponse = validateShowDates(showTimeRequests);
            System.out.println(apiResponse + " 58");
            if (apiResponse.getCode() != 200) {
                return apiResponse;
            }
            movieservice.dto.response.ApiResponse apiResponse2 = validateStartTimes(showTimeRequests);
            // 1. Kiểm tra trùng lịch ngay trong Request gửi lên
            if (apiResponse2.getCode() != 200) {
                return apiResponse2;
            }
            if (request.getShowTimes() != null) {
                for (ShowTimeRequest stReq : request.getShowTimes()) {
                    Optional<CinemaRoom> cinemaRoom = cinemaRoomRepository.findById(stReq.getCinemaRoomId().intValue());
                    if (cinemaRoom.isEmpty()) {
                        return movieservice.dto.response.ApiResponse.builder()
                                .code(904)
                                .message(
                                        "Phòng không tồn tại!!!")
                                .build();
                    }
                    movieservice.dto.response.ApiResponse apiResponse3 = validateLocalRequests(showTimeRequests,
                            request.getDuration());
                    if (apiResponse3.getCode() != 200) {
                        return apiResponse3;
                    }
                    ShowTime showTime = new ShowTime();
                    LocalTime startTime = stReq.getStartTime();
                    LocalTime endTime = startTime.plusMinutes(request.getDuration());

                    // Kiểm tra trùng lịch với Database
                    movieservice.dto.response.ApiResponse apiResponse4 = validateWithDatabase(stReq, startTime,
                            endTime);
                    if (apiResponse4.getCode() != 200) {
                        return apiResponse4;
                    }
                    showTime.setShowDate(stReq.getShowDate());
                    showTime.setStartTime(stReq.getStartTime());
                    showTime.setEndTime(stReq.getStartTime().plusMinutes(request.getDuration()));

                    showTime.setMovie(movie);

                    showTime.setCinemaRoom(cinemaRoom.get());
                    showTimeRepository.save(showTime);
                }
            }
            if (request.getTypeIds() != null) {
                for (Long typeId : request.getTypeIds()) {
                    Optional<TypeMovie> type = typeRepository.findById(typeId);
                    if (type.isEmpty()) {
                        return movieservice.dto.response.ApiResponse.builder()
                                .code(404)
                                .message(
                                        "Không tìm thấy thể loại với ID phù hợp!!!")
                                .build();
                    }
                    MovieConnect movieType = new MovieConnect();
                    MovieTypeId movieTypeId = new MovieTypeId();
                    movieTypeId.setMovieId(movie.getMovieId());
                    movieTypeId.setTypeId(typeId);
                    movieType.setId(movieTypeId);
                    movieType.setMovie(movie);
                    movieType.setType(type.get());
                    movieTypeRepository.save(movieType);
                }
            }
            return movieservice.dto.response.ApiResponse.builder()
                    .code(200)
                    .message("Tạo movie thành công")
                    .build();
        } catch (Exception e) {
            throw new RuntimeException("Lỗi hệ thống");
        }
    }

    public movieservice.dto.response.ApiResponse<?> getMovie(String id) {
        try {
            Integer.parseInt(id);
        } catch (Exception e) {
            return movieservice.dto.response.ApiResponse.builder()
                    .code(400)
                    .message("lỗi dữ liệu không hợp lệ")
                    .build();
        }
        Optional<Movie> movie = movieRepository.findById(Integer.parseInt(id));
        if (movie.isEmpty()) {
            return movieservice.dto.response.ApiResponse.builder()
                    .code(404)
                    .message("Không tìm thầy movie phù hợp")
                    .build();
        }
        return movieservice.dto.response.ApiResponse.builder()
                .code(200)
                .message("Lấy movie thành công")
                .build();
    }

    private movieservice.dto.response.ApiResponse<?> validateStartTimes(List<ShowTimeRequest> requests) {
        LocalTime openingTime = LocalTime.of(8, 0);
        LocalTime closingTime = LocalTime.of(23, 0);

        for (ShowTimeRequest stReq : requests) {
            LocalTime startTime = stReq.getStartTime();
            if (startTime.isBefore(openingTime) || startTime.isAfter(closingTime)) {
                return movieservice.dto.response.ApiResponse.builder()
                        .code(900)
                        .message("Giờ chiếu không hợp lệ! Rạp chỉ hoạt động trong khoảng từ 8h đến 23h.")
                        .build();
            }
        }
        return movieservice.dto.response.ApiResponse.builder()
                .code(200)
                .message("Tạo movie thành công!!!!")
                .build();
    }

    private movieservice.dto.response.ApiResponse<?> validateLocalRequests(List<ShowTimeRequest> requests,
            int duration) {
        for (int i = 0; i < requests.size(); i++) {
            ShowTimeRequest current = requests.get(i);
            LocalTime currentStart = current.getStartTime();
            LocalTime currentEnd = currentStart.plusMinutes(duration);

            for (int j = i + 1; j < requests.size(); j++) {
                ShowTimeRequest next = requests.get(j);

                if (current.getCinemaRoomId().equals(next.getCinemaRoomId())
                        && current.getShowDate().equals(next.getShowDate())) {

                    LocalTime nextStart = next.getStartTime();
                    LocalTime nextEnd = nextStart.plusMinutes(duration);

                    if (currentStart.isBefore(nextEnd) && currentEnd.isAfter(nextStart)) {
                        return movieservice.dto.response.ApiResponse.builder()
                                .code(901)
                                .message("Lỗi có lịch phim đã tồn tại trong phòng")
                                .build();
                    }
                }
            }
        }
        return movieservice.dto.response.ApiResponse.builder()
                .code(200)
                .message("Tạo movie thành công!!!!")
                .build();
    }

    private movieservice.dto.response.ApiResponse<?> validateShowDates(List<ShowTimeRequest> requests) {
        LocalDate minAllowedDate = LocalDate.now().plusDays(3);

        for (ShowTimeRequest stReq : requests) {
            if (stReq.getShowDate().isBefore(minAllowedDate)) {
                return movieservice.dto.response.ApiResponse.builder()
                        .code(902)
                        .message(
                                "Ngày chiếu không hợp lệ! Chỉ được đăng ký lịch chiếu tối thiểu 3 ngày sau tính từ hôm nay.")
                        .build();
            }
        }
        return movieservice.dto.response.ApiResponse.builder()
                .code(200)
                .message("Tạo movie thành công!!!!")
                .build();
    }

    private movieservice.dto.response.ApiResponse<?> validateWithDatabase(ShowTimeRequest stReq, LocalTime startTime,
            LocalTime endTime) {
        boolean isOverlapped = showTimeRepository.existsByCinemaRoomAndOverlappingTime(
                stReq.getCinemaRoomId(),
                stReq.getShowDate(),
                startTime,
                endTime);

        if (isOverlapped) {
            return movieservice.dto.response.ApiResponse.builder()
                    .code(903)
                    .message("Phòng đã có lịch chiếu khác.")
                    .build();
        }
        return movieservice.dto.response.ApiResponse.builder()
                .code(200)
                .message("Tạo movie thành công!!!!")
                .build();
    }

    public ResponseEntity<ApiResponse<List<MovieResponse>>> findAll() {
        List<Movie> movies = movieRepository.findAll();

        boolean isEmpty = movies.isEmpty();
        int statusCode = isEmpty ? 404 : 200;
        String message = isEmpty ? "Không tìm thầy movie phù hợp" : "Lấy danh sách phim thành công";

        List<MovieResponse> movieResponses = movieMapper.toResponseList(movies);

        ApiResponse<List<MovieResponse>> response = ApiResponse.<List<MovieResponse>>builder()
                .code(statusCode)
                .message(message)
                .result(isEmpty ? null : movieResponses)
                .build();

        return ResponseEntity.status(isEmpty ? 404 : 200).body(response);
    }

    public ResponseEntity<ApiResponse<?>> createCinemaRoom(CinemaRoomRequest cinemaRoomRequest) {
        if (cinemaRoomRepository.existsByCinemaRoomName(cinemaRoomRequest.getCinemaRoomName())) {

            ApiResponse<?> response = ApiResponse.builder()
                    .code(409)
                    .message("Tên phòng đã tồn tại!!!")
                    .build();

            // Trả về HttpStatus.CONFLICT (409) thay vì 200
            return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
        }

        CinemaRoom cinemaRoom = movieMapper.toCinemaRoom(cinemaRoomRequest);
        CinemaRoom room = cinemaRoomRepository.save(cinemaRoom);

        generateSeatsForRoom(room.getCinemaRoomId(), room.getSeatQuantity(), room);
        return ResponseEntity.ok(ApiResponse.builder()
                .code(200)
                .message("Tạo Room Cinema thành công")
                .build());
    }

    public void generateSeatsForRoom(Long cinemaRoomId, int quantity, CinemaRoom cinemaRoom) {
        int seatsPerRow = 10;

        for (int i = 0; i < quantity; i++) {
            char row = (char) ('A' + (i / seatsPerRow));
            int col = (i % seatsPerRow) + 1;

            String seatCode = row + String.valueOf(col);

            Seat seat = new Seat();
            seat.setSeatCode(seatCode);
            seat.setCinemaRoom(cinemaRoom);
            seat.setPrice(100000.0);
            seat.setSeatStatus("AVAILABLE");
            seat.setSeatType("STANDARD");

            seatRepository.save(seat);
        }
    }

    @Transactional
    public ResponseEntity<ApiResponse<?>> createTypeMovie(TypeRequest typeRequest) {
        // Kiểm tra tồn tại
        if (typeRepository.existsByTypeName(typeRequest.getTypeName())) {
            return ResponseEntity
                    .status(409) // HTTP Status 409
                    .body(ApiResponse.builder()
                            .code(409) // Business Code 409
                            .message("Tên loại phim đã tồn tại!")
                            .build());
        }

        // Logic lưu thành công
        TypeMovie type = movieMapper.toType(typeRequest);
        typeRepository.save(type);

        return ResponseEntity.ok(ApiResponse.builder()
                .code(200)
                .message("Tạo Loại phim thành công")
                .build());
    }
}
