package movieservice.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.CreateShowTimeRequest;
import movieservice.dto.request.ShowTimeRequest;
import movieservice.dto.request.UpdateShowTimeRequest;
import movieservice.dto.response.ShowTimeResponse;
import movieservice.dto.response.ShowtimeSeatDto;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeSeatRepository;
import movieservice.repository.SeatRepository;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ShowTimeService {
    ShowTimeRepository showTimeRepository;
    ShowtimeSeatRepository showtimeSeatRepository;
    SeatRepository seatRepository;
    MovieRepository movieRepository;
    CinemaRoomRepository cinemaRoomRepository;
    MovieMapper movieMapper;

    @Transactional
    public List<ShowtimeSeatDto> getSeatsByShowtime(Long showtimeId) {
        ShowTime showTime = showTimeRepository.findById(showtimeId)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND)); // Or a better error code

        List<ShowtimeSeat> seats = showtimeSeatRepository.findByShowTime_ShowTimeId(showtimeId);
        
        // Lazy initialize seats for this showtime if they don't exist
        if (seats.isEmpty()) {
            List<Seat> roomSeats = showTime.getCinemaRoom().getSeats();
            if (roomSeats == null || roomSeats.isEmpty()) {
                // If the room has no seats, return empty list
                return List.of();
            }

            seats = roomSeats.stream().map(seat -> {
                ShowtimeSeat showtimeSeat = new ShowtimeSeat();
                showtimeSeat.setShowTime(showTime);
                showtimeSeat.setSeat(seat);
                showtimeSeat.setSeatCode(seat.getSeatCode());
                showtimeSeat.setSeatType(seat.getSeatType() != null ? seat.getSeatType().name() : "STANDARD");
                showtimeSeat.setPrice(seat.getPrice() != null ? seat.getPrice() : new java.math.BigDecimal("100000.00"));
                showtimeSeat.setStatus(ShowtimeSeat.SeatStatus.AVAILABLE);
                return showtimeSeat;
            }).collect(Collectors.toList());
            
            showtimeSeatRepository.saveAll(seats);
        }

        return seats.stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public void lockSeats(Long showtimeId, List<Long> seatIds) {
        // Find seats
        for (Long seatId : seatIds) {
            ShowtimeSeat seat = showtimeSeatRepository.findById(seatId)
                    .orElseThrow(() -> new RuntimeException("Seat not found"));
            
            if (seat.getStatus() != ShowtimeSeat.SeatStatus.AVAILABLE) {
                // Check if reserved lock has expired
                if (seat.getStatus() == ShowtimeSeat.SeatStatus.RESERVED && seat.getReservedExpiresAt() != null && seat.getReservedExpiresAt().isBefore(LocalDateTime.now())) {
                    // Lock expired, we can proceed
                } else {
                    throw new RuntimeException("Seat is not available"); // Ideal: specialized exception
                }
            }
            
            seat.setStatus(ShowtimeSeat.SeatStatus.RESERVED);
            seat.setReservedAt(LocalDateTime.now());
            seat.setReservedExpiresAt(LocalDateTime.now().plusMinutes(15));
            showtimeSeatRepository.save(seat);
        }
    }

    private ShowtimeSeatDto toDto(ShowtimeSeat seat) {
        String status = "AVAILABLE";
        if (seat.getStatus() == ShowtimeSeat.SeatStatus.SOLD) {
            status = "BOOKED";
        } else if (seat.getStatus() == ShowtimeSeat.SeatStatus.RESERVED) {
            if (seat.getReservedExpiresAt() != null && seat.getReservedExpiresAt().isBefore(LocalDateTime.now())) {
                status = "AVAILABLE"; // lock expired
            } else {
                status = "LOCKED";
            }
        }

        String row = "";
        Integer number = 0;
        
        // Parse seatCode (e.g. A1, A2)
        if (seat.getSeatCode() != null) {
            Pattern pattern = Pattern.compile("([A-Za-z]+)(\\d+)");
            Matcher matcher = pattern.matcher(seat.getSeatCode());
            if (matcher.matches()) {
                row = matcher.group(1).toUpperCase();
                number = Integer.parseInt(matcher.group(2));
            } else {
                row = seat.getSeatCode();
            }
        }

        return ShowtimeSeatDto.builder()
                .seatId(seat.getShowtimeSeatId())
                .row(row)
                .number(number)
                .type(seat.getSeatType())
                .status(status)
                .price(seat.getPrice())
                .build();
    }

    public void validateStartTimes(List<ShowTimeRequest> requests) {
        LocalTime openingTime = LocalTime.of(8, 0);
        LocalTime closingTime = LocalTime.of(23, 0);

        for (ShowTimeRequest stReq : requests) {
            LocalTime startTime = stReq.getStartTime();
            if (startTime.isBefore(openingTime) || startTime.isAfter(closingTime)) {
                throw new AppException(MovieErrorCode.INVALID_SHOWTIME);
            }

        }
    }

    public void validateLocalRequests(List<ShowTimeRequest> requests,
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

    public void validateShowDates(List<ShowTimeRequest> requests) {
        LocalDate minAllowedDate = LocalDate.now().plusDays(3);

        for (ShowTimeRequest stReq : requests) {
            if (stReq.getShowDate().isBefore(minAllowedDate)) {
                throw new AppException(MovieErrorCode.INVALID_SHOWDATE);
            }
        }
    }

    public void validateWithDatabase(List<ShowTimeRequest> requests, int duration) {
        for (ShowTimeRequest stReq : requests) {

            LocalTime startTime = stReq.getStartTime();
            LocalTime endTime = startTime.plusMinutes(duration);

            boolean isOverlapped = showTimeRepository.existsByCinemaRoomAndOverlappingTime(
                    stReq.getCinemaRoomId(),
                    stReq.getShowDate(),
                    startTime,
                    endTime);

            if (isOverlapped) {
                throw new AppException(MovieErrorCode.SHOWTIME_CONFLICT_IN_DATABASE);
            }
        }
    }
    public Boolean existsMovie(Long movieId, LocalDate currentDate, LocalTime currentTime) {
        return showTimeRepository.existsByMovieMovieIdAndFutureShowTime(movieId, currentDate, currentTime);
    }

    public List<ShowTime> saveSchedule(List<ShowTime> showTimes) {
        return showTimeRepository.saveAll(showTimes);
    }

    // ── Read API ──────────────────────────────────────────────────────────────

    public List<ShowTimeResponse> getAll() {
        return movieMapper.toShowTimeResponseList(showTimeRepository.findAll());
    }

    public ShowTimeResponse getById(Long id) {
        ShowTime showTime = showTimeRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND));
        return movieMapper.toShowTimeResponse(showTime);
    }

    public List<ShowTimeResponse> getByMovieId(Long movieId, LocalDate date) {
        if (!movieRepository.existsById(movieId)) {
            throw new AppException(MovieErrorCode.MOVIE_NOT_FOUND);
        }
        List<ShowTime> results = (date != null)
                ? showTimeRepository.findByMovieMovieIdAndShowDate(movieId, date)
                : showTimeRepository.findByMovieMovieId(movieId);
        return movieMapper.toShowTimeResponseList(results);
    }

    // ── Write API ─────────────────────────────────────────────────────────────

    private static final LocalTime OPENING_TIME = LocalTime.of(8, 0);
    private static final LocalTime CLOSING_TIME  = LocalTime.of(23, 0);

    @Transactional
    public ShowTimeResponse createStandalone(CreateShowTimeRequest request) {
        // 1. Movie exists
        Movie movie = movieRepository.findById(request.getMovieId())
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

        // 2. Room exists
        CinemaRoom room = cinemaRoomRepository.findByCinemaRoomId(request.getCinemaRoomId());
        if (room == null) throw new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND);

        // 3. showDate >= today + 3
        if (request.getShowDate().isBefore(LocalDate.now().plusDays(3))) {
            throw new AppException(MovieErrorCode.INVALID_SHOWDATE);
        }

        // 4. startTime in 08:00–23:00, endTime = startTime + duration <= 23:00
        LocalTime startTime = request.getStartTime();
        LocalTime endTime   = startTime.plusMinutes(movie.getDurationMinutes());
        if (startTime.isBefore(OPENING_TIME) || endTime.isAfter(CLOSING_TIME)) {
            throw new AppException(MovieErrorCode.INVALID_SHOWTIME);
        }

        // 5. Overlap check with DB
        if (showTimeRepository.existsByCinemaRoomAndOverlappingTime(
                request.getCinemaRoomId(), request.getShowDate(), startTime, endTime)) {
            throw new AppException(MovieErrorCode.SHOWTIME_CONFLICT_IN_DATABASE);
        }

        // 6. Save
        ShowTime showTime = new ShowTime();
        showTime.setMovie(movie);
        showTime.setCinemaRoom(room);
        showTime.setShowDate(request.getShowDate());
        showTime.setStartTime(startTime);
        showTime.setEndTime(endTime);
        showTime.setUpdateAt(LocalDateTime.now());

        return toShowTimeResponse(showTimeRepository.save(showTime));
    }

    @Transactional
    public ShowTimeResponse update(Long id, UpdateShowTimeRequest request) {
        ShowTime showTime = showTimeRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND));

        // Apply non-null field updates
        if (request.getMovieId() != null) {
            Movie movie = movieRepository.findById(request.getMovieId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
            showTime.setMovie(movie);
        }

        if (request.getCinemaRoomId() != null) {
            CinemaRoom room = cinemaRoomRepository.findByCinemaRoomId(request.getCinemaRoomId());
            if (room == null) throw new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND);
            showTime.setCinemaRoom(room);
        }

        if (request.getShowDate() != null) {
            if (request.getShowDate().isBefore(LocalDate.now().plusDays(3))) {
                throw new AppException(MovieErrorCode.INVALID_SHOWDATE);
            }
            showTime.setShowDate(request.getShowDate());
        }

        if (request.getStartTime() != null) {
            LocalTime startTime = request.getStartTime();
            LocalTime endTime   = startTime.plusMinutes(showTime.getMovie().getDurationMinutes());
            if (startTime.isBefore(OPENING_TIME) || endTime.isAfter(CLOSING_TIME)) {
                throw new AppException(MovieErrorCode.INVALID_SHOWTIME);
            }
            showTime.setStartTime(startTime);
            showTime.setEndTime(endTime);
        }

        // Rerun overlap check (excluding self) when room, date, or time changed
        if (request.getCinemaRoomId() != null || request.getShowDate() != null || request.getStartTime() != null) {
            if (showTimeRepository.existsByCinemaRoomAndOverlappingTimeExcluding(
                    showTime.getCinemaRoom().getCinemaRoomId(),
                    showTime.getShowDate(),
                    showTime.getStartTime(),
                    showTime.getEndTime(),
                    id)) {
                throw new AppException(MovieErrorCode.SHOWTIME_CONFLICT_IN_DATABASE);
            }
        }

        showTime.setUpdateAt(LocalDateTime.now());
        return toShowTimeResponse(showTimeRepository.save(showTime));
    }

    @Transactional
    public void deleteById(Long id) {
        if (!showTimeRepository.existsById(id)) {
            throw new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND);
        }
        if (showTimeRepository.existsByShowTimeIdAndFutureShowTime(id, LocalDate.now(), LocalTime.now())) {
            throw new AppException(MovieErrorCode.ACTIVE_SHOWTIMES_EXIST);
        }
        showTimeRepository.deleteById(id);
    }

    private ShowTimeResponse toShowTimeResponse(ShowTime s) {
        ShowTimeResponse r = new ShowTimeResponse();
        r.setShowTimeId(s.getShowTimeId());
        r.setShowDate(s.getShowDate());
        r.setStartTime(s.getStartTime());
        r.setEndTime(s.getEndTime());
        r.setUpdateAt(s.getUpdateAt());
        if (s.getMovie() != null) {
            r.setMovieId(s.getMovie().getMovieId());
            r.setMovieName(s.getMovie().getOriginalTitle());
        }
        if (s.getCinemaRoom() != null) {
            r.setCinemaRoomId(s.getCinemaRoom().getCinemaRoomId());
            r.setCinemaRoomName(s.getCinemaRoom().getCinemaRoomName());
        }
        return r;
    }
}
