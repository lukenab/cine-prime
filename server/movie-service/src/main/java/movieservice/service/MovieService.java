package movieservice.service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.ShowTimeRequest;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.dto.response.ImageUploadResponse;
import movieservice.dto.response.MovieResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.MovieType;
import movieservice.entity.ShowTime;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.MovieRepository;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieService {
    private static final long MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

    MovieRepository movieRepository;
    MovieMapper movieMapper;
    CinemaRoomService cinemaRoomService;
    ImageStorageService imageStorageService;
    AuditLogService auditLogService;
    MovieTypeService movieTypeService;
    ShowTimeService showTimeService;
    @Transactional
    public MovieResponse createMovie(CreateMovieRequest request) {
        Movie movie = movieMapper.toMovie(request);
        movie = movieRepository.save(movie);

        List<ShowTimeRequest> showTimeRequests = request.getShowTimes();
        showTimeService.validateShowDates(showTimeRequests);
        showTimeService.validateStartTimes(showTimeRequests);
        showTimeService.validateLocalRequests(showTimeRequests, request.getDuration());
        showTimeService.validateWithDatabase(showTimeRequests, request.getDuration());
        if (showTimeRequests != null && !showTimeRequests.isEmpty()) {
            List<ShowTime> showTimesToSave = new ArrayList<>();

            for (ShowTimeRequest stReq : showTimeRequests) {
                CinemaRoom cinemaRoom = cinemaRoomService.findByCinemaRoom(stReq.getCinemaRoomId().longValue());
                if (cinemaRoom == null) {
                    throw new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND);
                }

                LocalTime startTime = stReq.getStartTime();
                LocalTime endTime = startTime.plusMinutes(request.getDuration());

                ShowTime showTime = new ShowTime();
                showTime.setShowDate(stReq.getShowDate());
                showTime.setStartTime(startTime);
                showTime.setEndTime(endTime);
                showTime.setMovie(movie);
                showTime.setCinemaRoom(cinemaRoom);

                showTimesToSave.add(showTime);
            }

            List<ShowTime> savedShowTimes = showTimeService.saveSchedule(showTimesToSave);
            movie.setShowTimes(savedShowTimes);
        }

        if (request.getTypeIds() != null && !request.getTypeIds().isEmpty()) {
            List<MovieType> types = movieTypeService.findAllById(request.getTypeIds());

            if (types.size() != request.getTypeIds().size()) {
                throw new AppException(MovieErrorCode.MOVIE_TYPE_NOT_FOUND);
            }
            movie.setMovieTypes(types);
        }

        try {
            movie.setSmallImage(resolveImageUrl(request.getSmallImage()));
            movie.setLargeImage(resolveImageUrl(request.getLargeImage()));
        } catch (Exception e) {
            throw new AppException(MovieErrorCode.UPLOAD_IMAGE_FAILED);
        }

        Movie finalSavedMovie = movieRepository.save(movie);

        auditLogService.logAction("1", "Admin System", "movie - id:" + finalSavedMovie.getMovieId(),
                "Created new movie: " + finalSavedMovie.getMovieNameEnglish());

        return movieMapper.toResponse(finalSavedMovie);
    }

    public ImageUploadResponse uploadMovieImage(MultipartFile file) {
        validateImageFile(file);

        try {
            Map uploadResult = imageStorageService.uploadImage(file);
            String url = getUploadValue(uploadResult, "url");
            String secureUrl = getUploadValue(uploadResult, "secure_url");
            String publicId = getUploadValue(uploadResult, "public_id");

            return ImageUploadResponse.builder()
                    .url(secureUrl != null ? secureUrl : url)
                    .secureUrl(secureUrl)
                    .publicId(publicId)
                    .build();
        } catch (Exception e) {
            throw new AppException(MovieErrorCode.UPLOAD_IMAGE_FAILED);
        }
    }

    private String resolveImageUrl(String imageUrl) throws java.io.IOException {
        if (imageUrl != null && imageUrl.contains("res.cloudinary.com")) {
            return imageUrl;
        }

        Map uploadResult = imageStorageService.uploadImage(imageUrl);
        String secureUrl = getUploadValue(uploadResult, "secure_url");
        String url = getUploadValue(uploadResult, "url");
        return secureUrl != null ? secureUrl : url;
    }

    private void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_IMAGE_SIZE_BYTES) {
            throw new AppException(MovieErrorCode.INVALID_IMAGE_FILE);
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.matches("image/(jpeg|jpg|png|webp)")) {
            throw new AppException(MovieErrorCode.INVALID_IMAGE_FILE);
        }
    }

    private String getUploadValue(Map uploadResult, String key) {
        Object value = uploadResult.get(key);
        return value != null ? value.toString() : null;
    }

    public MovieResponse getMovie(Long id) {
        Movie movie = movieRepository.findByMovieId(id);
        if (movie == null) {
           throw new AppException(MovieErrorCode.MOVIE_NOT_FOUND);
        }

        return movieMapper.toResponse(movie);
    }


    public Page<MovieResponse> findPageMovie(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);

        Page<Movie> moviePage = movieRepository.findAll(pageable);

        return moviePage.map(movieMapper::toResponse);
    }

    public List<MovieResponse> findAll() {
        List<Movie> movies = movieRepository.findByStatusTrue();
        return movieMapper.toResponseList(movies);
    }

    @Transactional
    public MovieResponse updateMovie(Long id, UpdateMovieRequest request) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

        movieMapper.updateMovieFromRequest(request, movie);

        if (request.getTypeIds() != null) {
            List<MovieType> updatedMovieTypes = new ArrayList<>();

            for (Long typeId : request.getTypeIds()) {
                MovieType type = movieTypeService.findByType(typeId);
                if (type == null) {
                    throw new AppException(MovieErrorCode.GENRE_NOT_FOUND);
                }
                updatedMovieTypes.add(type);
            }
            movie.setMovieTypes(updatedMovieTypes);
        }

        Movie savedMovie = movieRepository.save(movie);
        return movieMapper.toResponse(savedMovie);
    }

    @Transactional
    public void deleteMovie(Long id) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

        LocalDate currentDate = LocalDate.now();
        LocalTime currentTime = LocalTime.now();
        boolean hasFutureShowTimes = showTimeService.existsMovie(
                movie.getMovieId(), currentDate, currentTime);
        if (hasFutureShowTimes) {
            throw new AppException(MovieErrorCode.ACTIVE_SHOWTIMES_EXIST);
        }

        movieRepository.softDeleteMovie(movie.getMovieId());
    }
}
