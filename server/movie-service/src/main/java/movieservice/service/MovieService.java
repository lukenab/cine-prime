package movieservice.service;

import java.io.IOException;
import java.lang.reflect.Type;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.ShowTimeRequest;
import movieservice.dto.request.TypeRequest;
import movieservice.dto.response.MovieResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.MovieActionLog;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.entity.TypeMovie;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieActionLogRepository;
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
    SeatRepository seatRepository;
    MovieActionLogRepository movieActionLogRepository;
    Cloudinary cloudinary;

    @Transactional
    public ApiResponse<?> createMovie(CreateMovieRequest request) {
        Movie movie = movieMapper.toMovie(request);
        movieRepository.save(movie);
        List<ShowTimeRequest> showTimeRequests = request.getShowTimes();
        ApiResponse apiResponse = validateShowDates(showTimeRequests);
        if (apiResponse.getCode() != 200) {
            return apiResponse;
        }
        ApiResponse apiResponse2 = validateStartTimes(showTimeRequests);
        if (apiResponse2.getCode() != 200) {
            return apiResponse2;
        }
        if (request.getShowTimes() != null) {
            for (ShowTimeRequest stReq : request.getShowTimes()) {
                Optional<CinemaRoom> cinemaRoom = cinemaRoomRepository.findById(stReq.getCinemaRoomId().intValue());
                if (cinemaRoom.isEmpty()) {
                    throw new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND);
                }
                ApiResponse apiResponse3 = validateLocalRequests(showTimeRequests,
                        request.getDuration());
                if (apiResponse3.getCode() != 200) {
                    return apiResponse3;
                }
                ShowTime showTime = new ShowTime();
                LocalTime startTime = stReq.getStartTime();
                LocalTime endTime = startTime.plusMinutes(request.getDuration());

                ApiResponse apiResponse4 = validateWithDatabase(stReq, startTime,
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
            List<TypeMovie> types = new ArrayList<>();

            for (Long typeId : request.getTypeIds()) {
                Optional<TypeMovie> type = typeRepository.findById(typeId);
                if (type.isEmpty()) {
                    throw new AppException(MovieErrorCode.MOVIE_TYPE_NOT_FOUND);
                }

                types.add(type.get());
            }
            movie.setTypes(types);
        }
        try {
            Map uploadSmallImage = uploadImage(request.getSmallImage());
            Map uploadLagreImage = uploadImage(request.getLargeImage());
            movie.setLargeImage(uploadSmallImage.get("url").toString());
            movie.setLargeImage(uploadLagreImage.get("url").toString());
        } catch (Exception e) {
            throw new AppException(MovieErrorCode.UPLOAD_IMAGE_FAILED);
        }
        Movie movie2 = movieRepository.save(movie);
        logAction("1", "Admin System","movie - id:" + String.valueOf(movie2.getMovieId()), "Created new movie: " + movie2.getMovieNameEnglish());

        
        return ApiResponse.builder()
                .code(200)
                .message("Movie created successfully")
                .result("OK")
                .build();
    }

    public void logAction(String accountId, String actor, String note, String content) {
        MovieActionLog log = new MovieActionLog();
        log.setAccountId(accountId);
        log.setActor(actor);
        log.setNote(note);
        log.setActionDescription(content);
        log.setTimestamp(LocalDateTime.now());
        movieActionLogRepository.save(log);
    }

    public MovieResponse getMovie(Long id) {
        Movie movie = movieRepository.findById(id).orElseThrow(() -> new RuntimeException("error"));
        return movieMapper.toResponse(movie);
    }

    private ApiResponse<?> validateStartTimes(List<ShowTimeRequest> requests) {
        LocalTime openingTime = LocalTime.of(8, 0);
        LocalTime closingTime = LocalTime.of(23, 0);

        for (ShowTimeRequest stReq : requests) {
            LocalTime startTime = stReq.getStartTime();
            if (startTime.isBefore(openingTime) || startTime.isAfter(closingTime)) {
                throw new AppException(MovieErrorCode.INVALID_SHOWTIME);
            }

        }
        return ApiResponse.builder()
                .code(200)
                .message("Successful")
                .result("OK")
                .build();
    }

    private ApiResponse<?> validateLocalRequests(List<ShowTimeRequest> requests,
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
                        throw new AppException(MovieErrorCode.SHOWTIME_CONFLICT_IN_REQUEST);
                    }
                }
            }
        }
        return ApiResponse.builder()
                .code(200)
                .message("Successful")
                .result("OK")
                .build();
    }

    private ApiResponse<?> validateShowDates(List<ShowTimeRequest> requests) {
        LocalDate minAllowedDate = LocalDate.now().plusDays(3);

        for (ShowTimeRequest stReq : requests) {
            if (stReq.getShowDate().isBefore(minAllowedDate)) {
                throw new AppException(MovieErrorCode.INVALID_SHOWDATE);
            }
        }
        return ApiResponse.builder()
                .code(200)
                .message("Successful")
                .result("OK")
                .build();
    }

    private ApiResponse<?> validateWithDatabase(ShowTimeRequest stReq, LocalTime startTime,
            LocalTime endTime) {
        boolean isOverlapped = showTimeRepository.existsByCinemaRoomAndOverlappingTime(
                stReq.getCinemaRoomId(),
                stReq.getShowDate(),
                startTime,
                endTime);
        if (isOverlapped) {
            throw new AppException(MovieErrorCode.SHOWTIME_CONFLICT_IN_DATABASE);
        }
        return ApiResponse.builder()
                .code(200)
                .message("Successful")
                .result("OK")
                .build();
    }

    public ApiResponse<Page<MovieResponse>> findPageMovie(int page, int size) {

        Pageable pageable = PageRequest.of(page, size);

        Page<Movie> moviePage = movieRepository.findAll(pageable);
        Page<MovieResponse> movieResponses = moviePage.map(movieMapper::toResponse);
        boolean isEmpty = movieResponses.isEmpty();

        ApiResponse<Page<MovieResponse>> response = ApiResponse.<Page<MovieResponse>>builder()
                .code(isEmpty ? 404 : 200)
                .message(isEmpty
                        ? "No movies found"
                        : "Movie list retrieved successfully")
                .result(isEmpty ? null : movieResponses)
                .build();

        return response;
    }

    public ApiResponse<?> createCinemaRoom(CinemaRoomRequest cinemaRoomRequest) {
        if (cinemaRoomRepository.existsByCinemaRoomName(cinemaRoomRequest.getCinemaRoomName())) {

            throw new AppException(MovieErrorCode.CINEMA_ROOM_NAME_EXISTED);
        }

        CinemaRoom cinemaRoom = movieMapper.toCinemaRoom(cinemaRoomRequest);
        CinemaRoom room = cinemaRoomRepository.save(cinemaRoom);

        generateSeatsForRoom(room.getCinemaRoomId(), room.getSeatQuantity(), room);
        logAction("1", "Admin System", "cinema - id:" + String.valueOf(room.getCinemaRoomId()), "Created new cinema: " + room.getCinemaRoomName());

        return ApiResponse.builder()
                .code(200)
                .message("Cinema room created successfully")
                .result("OK")
                .build();
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
    public ApiResponse<?> createTypeMovie(TypeRequest typeRequest) {
        if (typeRepository.existsByTypeName(typeRequest.getTypeName())) {
            throw new AppException(MovieErrorCode.MOVIE_TYPE_NAME_EXISTED);
        }
        TypeMovie type = movieMapper.toType(typeRequest);
        TypeMovie typeTmp = typeRepository.save(type);
        logAction("1", "Admin System", "type - id:" + String.valueOf(typeTmp.getTypeId()), "Created new type movie: " + typeTmp.getTypeName());

        return ApiResponse.builder()
                .code(200)
                .message("Movie type created successfully")
                .result("OK")
                .build();
    }

    public Map uploadImage(String fileUrlOrPath) throws IOException {
        return cloudinary.uploader().upload(fileUrlOrPath, ObjectUtils.emptyMap());
    }
}
