package movieservice.service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.ShowTimeRequest;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.dto.response.MovieResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.MovieType;
import movieservice.entity.MovieTypeId;
import movieservice.entity.ShowTime;
import movieservice.entity.Type;
import movieservice.exception.ResponseWrapper;
import movieservice.exception.ResourceNotFoundException;
import movieservice.exception.MovieErrorCode;
import movie.theater.common.exception.AppException;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.MovieTypeRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.TypeRepository;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieService {
    MovieRepository movieRepository;
    TypeRepository typeRepository;
    ShowTimeRepository showTimeRepository;
    MovieMapper movieMapper;
    CinemaRoomRepository cinemaRoomRepository;
    MovieTypeRepository movieTypeRepository;

    @Transactional
    public ResponseEntity<?> createMovie(CreateMovieRequest request) {
        try {
            Movie movie = movieMapper.toMovie(request);
            movieRepository.save(movie);
            List<ShowTimeRequest> showTimeRequests = request.getShowTimes();
            validateShowDates(showTimeRequests);
            // 1. Kiểm tra trùng lịch ngay trong Request gửi lên
            validateStartTimes(showTimeRequests);
            if (request.getShowTimes() != null) {
                for (ShowTimeRequest stReq : request.getShowTimes()) {
                    CinemaRoom cinemaRoom = cinemaRoomRepository.findById(stReq.getCinemaRoomId().intValue())
                            .orElseThrow(() -> new RuntimeException(
                                    "Phòng chiếu không tồn tại với ID: " + stReq.getCinemaRoomId()));
                    validateLocalRequests(showTimeRequests, request.getDuration());
                    ShowTime showTime = new ShowTime();
                    System.out.println("Processing: " + stReq.getCinemaRoomId() + " - " + stReq.getStartTime());
                    LocalTime startTime = stReq.getStartTime();
                    LocalTime endTime = startTime.plusMinutes(request.getDuration());

                    // Kiểm tra trùng lịch với Database
                    validateWithDatabase(stReq, startTime, endTime);
                    showTime.setShowDate(stReq.getShowDate());
                    showTime.setStartTime(stReq.getStartTime());
                    showTime.setEndTime(stReq.getStartTime().plusMinutes(request.getDuration()));

                    showTime.setMovie(movie);

                    showTime.setCinemaRoom(cinemaRoom);
                    showTimeRepository.save(showTime);
                }
            }
            if (request.getTypeIds() != null) {
                for (Long typeId : request.getTypeIds()) {
                    Type type = typeRepository.findById(typeId)
                            .orElseThrow(() -> new RuntimeException("Không tìm thấy thể loại với ID: " + typeId));
                    MovieType movieType = new MovieType();
                    MovieTypeId movieTypeId = new MovieTypeId();
                    movieTypeId.setMovieId(movie.getMovieId());
                    movieTypeId.setTypeId(typeId);
                    movieType.setId(movieTypeId);
                    movieType.setMovie(movie);
                    movieType.setType(type);
                    movieTypeRepository.save(movieType);
                }
            }
            return ResponseEntity
                    .ok(new ResponseWrapper<>("Tạo movie thành công", null));
        } catch (RuntimeException e) {
            String msg = e.getMessage() == null ? "Lỗi nội bộ" : e.getMessage();
            // 404: Không tìm thấy
            if (msg.toLowerCase().contains("không tìm thấy") || msg.toLowerCase().contains("không tồn tại")) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ResponseWrapper<>("404", msg, "NOT_FOUND"));
            }
            // 409: Trùng lịch (Conflict)
            if (msg.toLowerCase().contains("trùng") || msg.toLowerCase().contains("đè nhau")) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(new ResponseWrapper<>("409", msg, "CONFLICT"));
            }
            // 400: Bad Request - validation errors
            if (msg.toLowerCase().contains("không hợp lệ") || msg.toLowerCase().contains("ngày chiếu")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ResponseWrapper<>("400", msg, "BAD_REQUEST"));
            }
            // Default 409
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new ResponseWrapper<>("409", msg, "CONFLICT"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ResponseWrapper<>("500", "Lỗi máy chủ nội bộ", "INTERNAL_SERVER_ERROR"));
        }
    }

    public ResponseEntity<?> getMovie(Long id) {
        Movie movie = movieRepository.findById(id.intValue())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phim với ID: " + id));

        return ResponseEntity.ok(new ResponseWrapper<>("Lấy movie thành công", movieMapper.toResponse(movie)));
    }

    private void validateStartTimes(List<ShowTimeRequest> requests) {
        LocalTime openingTime = LocalTime.of(8, 0);
        LocalTime closingTime = LocalTime.of(23, 30);

        for (ShowTimeRequest stReq : requests) {
            LocalTime startTime = stReq.getStartTime();
            if (startTime.isBefore(openingTime) || startTime.isAfter(closingTime)) {
                throw new RuntimeException(String.format(
                        "Giờ chiếu %s không hợp lệ! Rạp chỉ hoạt động trong khoảng từ %s đến %s.",
                        startTime, openingTime, closingTime));
            }
            if (startTime.getMinute() % 5 != 0) {
                throw new RuntimeException(String.format(
                        "Giờ chiếu %s không hợp lệ! Phút của suất chiếu phải là bội số của 5 (Ví dụ: :00, :05, :10,...).",
                        startTime));
            }
        }
    }

    private void validateLocalRequests(List<ShowTimeRequest> requests, int duration) {
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
                        throw new RuntimeException(String.format(
                                "Lỗi trùng lịch trong Request: Phòng %d có 2 suất chiếu bị đè nhau (%s và %s) vào ngày %s",
                                current.getCinemaRoomId(), currentStart, nextStart, current.getShowDate()));
                    }
                }
            }
        }
    }

    private void validateShowDates(List<ShowTimeRequest> requests) {
        LocalDate minAllowedDate = LocalDate.now().plusDays(3);

        for (ShowTimeRequest stReq : requests) {
            if (stReq.getShowDate().isBefore(minAllowedDate)) {
                throw new RuntimeException(String.format(
                        "Ngày chiếu %s không hợp lệ! Chỉ được đăng ký lịch chiếu từ ngày %s trở đi (tối thiểu 3 ngày sau tính từ hôm nay).",
                        stReq.getShowDate(), minAllowedDate));
            }
        }
    }


    private void validateWithDatabase(ShowTimeRequest stReq, LocalTime startTime, LocalTime endTime) {
        boolean isOverlapped = showTimeRepository.existsByCinemaRoomAndOverlappingTime(
                stReq.getCinemaRoomId(),
                stReq.getShowDate(),
                startTime,
                endTime);

        if (isOverlapped) {
            throw new RuntimeException(String.format(
                    "Phòng %d đã có lịch chiếu khác trong khoảng %s -> %s vào ngày %s",
                    stReq.getCinemaRoomId(), startTime, endTime, stReq.getShowDate()));
        }
    }
    public List<MovieResponse> findAll() {
        List<Movie> movies = movieRepository.findByStatusTrue();
        return movieMapper.toResponseList(movies);
    }

    @Transactional
    public MovieResponse updateMovie(Long id, UpdateMovieRequest request) {
        Movie movie = movieRepository.findById(id.intValue())
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

        movieMapper.updateMovieFromRequest(request, movie);
        movieRepository.save(movie);

        if (request.getTypeIds() != null) {
            movieTypeRepository.deleteByMovie(movie);
            List<MovieType> updatedMovieTypes = new ArrayList<>();
            for (Long typeId : request.getTypeIds()) {
                Type type = typeRepository.findById(typeId)
                        .orElseThrow(() -> new AppException(MovieErrorCode.GENRE_NOT_FOUND));
                MovieType movieType = new MovieType();
                MovieTypeId movieTypeId = new MovieTypeId();
                movieTypeId.setMovieId(movie.getMovieId());
                movieTypeId.setTypeId(typeId);
                movieType.setId(movieTypeId);
                movieType.setMovie(movie);
                movieType.setType(type);
                movieTypeRepository.save(movieType);
                updatedMovieTypes.add(movieType);
            }
            movie.setMovieTypes(updatedMovieTypes);
        }

        Movie updatedMovie = movieRepository.findById(id.intValue()).orElse(movie);
        return movieMapper.toResponse(updatedMovie);
    }

    @Transactional
    public void deleteMovie(Long id) {
        Movie movie = movieRepository.findById(id.intValue())
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

        LocalDate currentDate = LocalDate.now();
        LocalTime currentTime = LocalTime.now();
        boolean hasFutureShowTimes = showTimeRepository.existsByMovieMovieIdAndFutureShowTime(
                movie.getMovieId(), currentDate, currentTime);
        if (hasFutureShowTimes) {
            throw new AppException(MovieErrorCode.ACTIVE_SHOWTIMES_EXIST);
        }

        movieRepository.softDeleteMovie(movie.getMovieId());
    }

}
