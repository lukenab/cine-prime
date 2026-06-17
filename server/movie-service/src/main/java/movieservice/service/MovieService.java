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
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.dto.response.MovieResponse;
import movieservice.dto.response.TypeMovieResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.MovieActionLog;
import movieservice.entity.MovieType;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.exception.MovieErrorCode;
import movieservice.exception.ResponseWrapper;
import movieservice.exception.ResourceNotFoundException;
import movieservice.exception.MovieErrorCode;
import movie.theater.common.exception.AppException;
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

    public MovieResponse createMovie(CreateMovieRequest request) {
        Movie movie = movieMapper.toMovie(request);
        movie = movieRepository.save(movie);

        List<ShowTimeRequest> showTimeRequests = request.getShowTimes();
        validateShowDates(showTimeRequests);
        validateStartTimes(showTimeRequests);

        if (showTimeRequests != null && !showTimeRequests.isEmpty()) {
            List<ShowTime> showTimesToSave = new ArrayList<>(); 

            for (ShowTimeRequest stReq : showTimeRequests) {
                Optional<CinemaRoom> cinemaRoom = cinemaRoomRepository.findById(stReq.getCinemaRoomId().intValue());
                if (cinemaRoom.isEmpty()) {
                    throw new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND);
                }

                validateLocalRequests(showTimeRequests, request.getDuration());

                LocalTime startTime = stReq.getStartTime();
                LocalTime endTime = startTime.plusMinutes(request.getDuration());
                validateWithDatabase(stReq, startTime, endTime);

                ShowTime showTime = new ShowTime();
                showTime.setShowDate(stReq.getShowDate());
                showTime.setStartTime(startTime);
                showTime.setEndTime(endTime);
                showTime.setMovie(movie);
                showTime.setCinemaRoom(cinemaRoom.get());

                showTimesToSave.add(showTime); 
            }

            List<ShowTime> savedShowTimes = showTimeRepository.saveAll(showTimesToSave);
            movie.setShowTimes(savedShowTimes);
        }

        if (request.getTypeIds() != null && !request.getTypeIds().isEmpty()) {
            List<MovieType> types = typeRepository.findAllById(request.getTypeIds());

            if (types.size() != request.getTypeIds().size()) {
                throw new AppException(MovieErrorCode.MOVIE_TYPE_NOT_FOUND);
            }
            movie.setMovieTypes(types);
        }

        try {
            Map uploadSmallImage = uploadImage(request.getSmallImage());
            Map uploadLagreImage = uploadImage(request.getLargeImage());
            movie.setSmallImage(uploadSmallImage.get("url").toString());
            movie.setLargeImage(uploadLagreImage.get("url").toString());
        } catch (Exception e) {
            throw new AppException(MovieErrorCode.UPLOAD_IMAGE_FAILED);
        }

        Movie finalSavedMovie = movieRepository.save(movie);

        logAction("1", "Admin System", "movie - id:" + finalSavedMovie.getMovieId(),
                "Created new movie: " + finalSavedMovie.getMovieNameEnglish());

        return movieMapper.toResponse(finalSavedMovie);
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

    private void validateStartTimes(List<ShowTimeRequest> requests) {
        LocalTime openingTime = LocalTime.of(8, 0);
        LocalTime closingTime = LocalTime.of(23, 0);

        for (ShowTimeRequest stReq : requests) {
            LocalTime startTime = stReq.getStartTime();
            if (startTime.isBefore(openingTime) || startTime.isAfter(closingTime)) {
                throw new AppException(MovieErrorCode.INVALID_SHOWTIME);
            }

        }
    }

    private void validateLocalRequests(List<ShowTimeRequest> requests,
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
    }

    private void validateShowDates(List<ShowTimeRequest> requests) {
        LocalDate minAllowedDate = LocalDate.now().plusDays(3);

        for (ShowTimeRequest stReq : requests) {
            if (stReq.getShowDate().isBefore(minAllowedDate)) {
                throw new AppException(MovieErrorCode.INVALID_SHOWDATE);
            }
        }
    }

    private void validateWithDatabase(ShowTimeRequest stReq, LocalTime startTime,
            LocalTime endTime) {
        boolean isOverlapped = showTimeRepository.existsByCinemaRoomAndOverlappingTime(
                stReq.getCinemaRoomId(),
                stReq.getShowDate(),
                startTime,
                endTime);
        if (isOverlapped) {
            throw new AppException(MovieErrorCode.SHOWTIME_CONFLICT_IN_DATABASE);
        }
    }
    public Page<MovieResponse> findPageMovie(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);

        Page<Movie> moviePage = movieRepository.findAll(pageable);

        return moviePage.map(movieMapper::toResponse);
    }

    @Transactional
    public CinemaRoomResponse createCinemaRoom(CinemaRoomRequest cinemaRoomRequest) {
        if (cinemaRoomRepository.existsByCinemaRoomName(cinemaRoomRequest.getCinemaRoomName())) {

            throw new AppException(MovieErrorCode.CINEMA_ROOM_NAME_EXISTED);
        }

        CinemaRoom cinemaRoom = movieMapper.toCinemaRoom(cinemaRoomRequest);
        CinemaRoom room = cinemaRoomRepository.save(cinemaRoom);
        CinemaRoomResponse cinemaRoomResponse = movieMapper.toCinemaResponse(cinemaRoom);
        generateSeatsForRoom(room.getCinemaRoomId(), room.getSeatQuantity(), room);
        logAction("1", "Admin System", "cinema - id:" + String.valueOf(room.getCinemaRoomId()),
                "Created new cinema: " + room.getCinemaRoomName());
        return cinemaRoomResponse;
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
    public TypeMovieResponse createTypeMovie(TypeRequest typeRequest) {
        if (typeRepository.existsByTypeName(typeRequest.getTypeName())) {
            throw new AppException(MovieErrorCode.MOVIE_TYPE_NAME_EXISTED);
        }
        MovieType type = movieMapper.toType(typeRequest);
        MovieType typeTmp = typeRepository.save(type);
        logAction("1", "Admin System", "type - id:" + String.valueOf(typeTmp.getTypeId()),
                "Created new type movie: " + typeTmp.getTypeName());
        TypeMovieResponse typeMovieResponse = movieMapper.toMovieResponse(typeTmp);
        return typeMovieResponse;

    }

    public Map uploadImage(String fileUrlOrPath) throws IOException {
        return cloudinary.uploader().upload(fileUrlOrPath, ObjectUtils.emptyMap());
    }
    public List<MovieResponse> findAll() {
        List<Movie> movies = movieRepository.findByStatusTrue();
        return movieMapper.toResponseList(movies);
    }

    // @Transactional
    // public MovieResponse updateMovie(Long id, UpdateMovieRequest request) {
    //     Movie movie = movieRepository.findById(id)
    //             .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

    //     movieMapper.updateMovieFromRequest(request, movie);
    //     movieRepository.save(movie);

    //     if (request.getTypeIds() != null) {
    //         movieTypeRepository.deleteByMovie(movie);
    //         List<MovieType> updatedMovieTypes = new ArrayList<>();
    //         for (Long typeId : request.getTypeIds()) {
    //             Type type = typeRepository.findById(typeId)
    //                     .orElseThrow(() -> new AppException(MovieErrorCode.GENRE_NOT_FOUND));
    //             MovieType movieType = new MovieType();
    //             MovieTypeId movieTypeId = new MovieTypeId();
    //             movieTypeId.setMovieId(movie.getMovieId());
    //             movieTypeId.setTypeId(typeId);
    //             movieType.setId(movieTypeId);
    //             movieType.setMovie(movie);
    //             movieType.setType(type);
    //             movieTypeRepository.save(movieType);
    //             updatedMovieTypes.add(movieType);
    //         }
    //         movie.setMovieTypes(updatedMovieTypes);
    //     }

    //     Movie updatedMovie = movieRepository.findById(id.intValue()).orElse(movie);
    //     return movieMapper.toResponse(updatedMovie);
    // }

    @Transactional
    public void deleteMovie(Long id) {
        Movie movie = movieRepository.findById(id)
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
