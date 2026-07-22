package movieservice.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
import movieservice.dto.request.BulkShowTimeRequest;
import movieservice.dto.request.CreateShowTimeRequest;
import movieservice.dto.request.ShowTimeRequest;
import movieservice.dto.request.UpdateShowTimeRequest;
import movieservice.dto.response.BulkShowTimeCreateResponse;
import movieservice.dto.response.BulkShowTimePreviewResponse;
import movieservice.dto.response.ShowTimeCandidateDto;
import movieservice.dto.response.ShowTimeConflictDto;
import movieservice.dto.response.ShowTimePricingResponse;
import movieservice.dto.response.ShowTimeResponse;
import movieservice.dto.response.ShowtimeSeatDto;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.SeatStatus;
import movieservice.enums.SeatType;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.ClusterStatus;
import movieservice.enums.LayoutStatus;
import movieservice.enums.ShowTimeStatus;
import movieservice.enums.ShowtimeSeatStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.util.SeatLayoutUtil;
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
    RoomLayoutRepository roomLayoutRepository;
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
                showtimeSeat.setSeatType(seat.getSeatType() != null ? seat.getSeatType() : SeatType.STANDARD);
                showtimeSeat.setPrice(resolveSeatPrice(showTime, seat));
                showtimeSeat.setStatus(ShowtimeSeatStatus.AVAILABLE);
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
            
            if (seat.getStatus() != ShowtimeSeatStatus.AVAILABLE) {
                // Check if reserved lock has expired
                if (seat.getStatus() == ShowtimeSeatStatus.RESERVED && seat.getReservedExpiresAt() != null && seat.getReservedExpiresAt().isBefore(LocalDateTime.now())) {
                    // Lock expired, we can proceed
                } else {
                    throw new RuntimeException("Seat is not available"); // Ideal: specialized exception
                }
            }
            
            seat.setStatus(ShowtimeSeatStatus.RESERVED);
            seat.setReservedAt(LocalDateTime.now());
            seat.setReservedExpiresAt(LocalDateTime.now().plusMinutes(15));
            showtimeSeatRepository.save(seat);
        }
    }

    private ShowtimeSeatDto toDto(ShowtimeSeat seat) {
        String status = "AVAILABLE";
        if (seat.getStatus() == ShowtimeSeatStatus.SOLD) {
            status = "BOOKED";
        } else if (seat.getStatus() == ShowtimeSeatStatus.RESERVED) {
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

        int colSpan = seat.getSeatType() != null ? seat.getSeatType().getColSpan() : 1;
        Boolean aisleAfter = null;
        if (seat.getSeat() != null && seat.getSeat().getCinemaRoom() != null) {
            int seatsPerRow = seat.getSeat().getCinemaRoom().getSeatsPerRow();
            aisleAfter = SeatLayoutUtil.hasAisleAfter(number, colSpan, seatsPerRow);
        }

        return ShowtimeSeatDto.builder()
                .seatId(seat.getShowtimeSeatId())
                .row(row)
                .number(number)
                .type(seat.getSeatType() != null ? seat.getSeatType().name() : null)
                .colSpan(colSpan)
                .aisleAfter(aisleAfter)
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

    /** MOV-LC-07: earliest upcoming saleable showtime for a movie at a cluster, if any. */
    public Optional<ShowTime> findNextSaleableShowTime(Long movieId, Long clusterId, LocalDate currentDate, LocalTime currentTime) {
        List<ShowTime> upcoming = showTimeRepository.findUpcomingSaleableByMovieAndCluster(
                movieId, clusterId, currentDate, currentTime);
        return upcoming.isEmpty() ? Optional.empty() : Optional.of(upcoming.get(0));
    }

    public List<ShowTime> saveSchedule(List<ShowTime> showTimes) {
        return showTimeRepository.saveAll(showTimes);
    }

    // ── Read API ──────────────────────────────────────────────────────────────

    public List<ShowTimeResponse> getAll() {
        List<ShowTimeResponse> responses = movieMapper.toShowTimeResponseList(showTimeRepository.findAll());
        enrichPrices(responses);
        return responses;
    }

    public ShowTimeResponse getById(Long id) {
        ShowTime showTime = showTimeRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND));
        ShowTimeResponse response = movieMapper.toShowTimeResponse(showTime);
        enrichPrices(List.of(response));
        return response;
    }

    public List<ShowTimeResponse> getByMovieId(Long movieId, LocalDate date) {
        if (!movieRepository.existsById(movieId)) {
            throw new AppException(MovieErrorCode.MOVIE_NOT_FOUND);
        }
        List<ShowTime> results = (date != null)
                ? showTimeRepository.findByMovieMovieIdAndShowDate(movieId, date)
                : showTimeRepository.findByMovieMovieId(movieId);
        List<ShowTimeResponse> responses = movieMapper.toShowTimeResponseList(results);
        enrichPrices(responses);
        return responses;
    }

    /** Ghi gia thap nhat cua tung phong vao moi response — gom theo cinemaRoomId de chi
     *  query gia 1 lan cho moi phong dung, tranh N+1 khi nhieu suat chieu chung 1 phong. */
    private void enrichPrices(List<ShowTimeResponse> responses) {
        Map<Long, BigDecimal> priceByRoom = new HashMap<>();
        for (ShowTimeResponse r : responses) {
            if (r.getCinemaRoomId() == null) continue;
            BigDecimal price = priceByRoom.computeIfAbsent(r.getCinemaRoomId(),
                    roomId -> seatRepository.findMinPriceByCinemaRoomIdAndStatus(roomId, SeatStatus.ACTIVE));
            r.setPrice(price);
        }
    }

    // ── Write API ─────────────────────────────────────────────────────────────

    private static final LocalTime OPENING_TIME = LocalTime.of(8, 0);
    private static final LocalTime CLOSING_TIME  = LocalTime.of(23, 0);
    private static final int MAX_BULK_DATE_RANGE_DAYS = 31;
    private static final int MAX_BULK_CANDIDATES = 5_000;

    @Transactional
    public ShowTimePricingResponse createStandalone(CreateShowTimeRequest request) {
        // 1. Movie exists
        Movie movie = movieRepository.findById(request.getMovieId())
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

        // 2. Room exists
        CinemaRoom room = cinemaRoomRepository.findByCinemaRoomId(request.getCinemaRoomId());
        if (room == null) throw new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND);
        validateSchedulableRoom(room);

        // 3. showDate >= today + 3
        if (request.getShowDate().isBefore(LocalDate.now().plusDays(3))) {
            throw new AppException(MovieErrorCode.INVALID_SHOWDATE);
        }

        // 4. startTime in 08:00–23:00, endTime = startTime + duration <= 23:00
        LocalTime startTime = request.getStartTime();
        LocalTime endTime = validateAndCalculateEndTime(
                request.getShowDate(), startTime, movie.getDurationMinutes());

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
        showTime.setStatus(ShowTimeStatus.SCHEDULED);
        showTime.setTotalSeats(room.getTotalSeatCapacity());
        showTime.setLanguageCode(request.getLanguageCode() != null ? request.getLanguageCode() : "vi");
        showTime.setSubtitleCode(request.getSubtitleCode());
        showTime.setBasePrice(request.getBasePrice());

        return toShowTimePricingResponse(showTimeRepository.save(showTime));
    }

    // ── Bulk Generation API ───────────────────────────────────────────────────

    /**
     * POST /api/schedules/generate-preview
     * Dry-run: generates candidate showtimes and detects conflicts without saving anything.
     */
    @Transactional(readOnly = true)
    public BulkShowTimePreviewResponse generatePreview(BulkShowTimeRequest request) {
        NormalizedBulkInput input = validateAndNormalizeBulkRequest(request);
        Movie movie = movieRepository.findById(request.getMovieId())
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

        Map<Long, CinemaRoom> roomById = indexRooms(cinemaRoomRepository.findAllById(input.roomIds()));
        validateSchedulableRooms(input.roomIds(), roomById);
        List<ShowTime> existing = showTimeRepository.findActiveByRoomsAndDateRange(
                input.roomIds(), request.getFromDate(), request.getToDate());
        CandidateResult result = buildCandidateResult(request, input, movie, roomById, existing);

        return BulkShowTimePreviewResponse.builder()
                .validCount(result.valid().size())
                .conflictCount(result.conflicts().size())
                .valid(result.valid())
                .conflicts(result.conflicts())
                .build();
    }

    /**
     * POST /api/schedules/bulk
     * Persists only the valid, non-conflicting candidates in a single transaction.
     */
    @Transactional
    public BulkShowTimeCreateResponse bulkCreate(BulkShowTimeRequest request) {
        NormalizedBulkInput input = validateAndNormalizeBulkRequest(request);
        Movie movie = movieRepository.findById(request.getMovieId())
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

        // Lock rooms in a stable order. Concurrent bulk requests touching the
        // same rooms are serialized before the final conflict check and save.
        Map<Long, CinemaRoom> roomById = indexRooms(
                cinemaRoomRepository.findAllByIdForUpdate(input.roomIds()));
        validateSchedulableRooms(input.roomIds(), roomById);
        List<ShowTime> existing = showTimeRepository.findActiveByRoomsAndDateRange(
                input.roomIds(), request.getFromDate(), request.getToDate());
        CandidateResult result = buildCandidateResult(request, input, movie, roomById, existing);

        // Build entities for all valid candidates
        List<ShowTime> toSave = result.valid().stream().map(candidate -> {
            CinemaRoom room = roomById.get(candidate.getCinemaRoomId());
            ShowTime st = new ShowTime();
            st.setMovie(movie);
            st.setCinemaRoom(room);
            st.setShowDate(candidate.getShowDate());
            st.setStartTime(candidate.getStartTime());
            st.setEndTime(candidate.getEndTime());
            st.setStatus(ShowTimeStatus.SCHEDULED);
            st.setTotalSeats(room.getTotalSeatCapacity());
            st.setLanguageCode(request.getLanguageCode() != null ? request.getLanguageCode() : "vi");
            st.setSubtitleCode(request.getSubtitleCode());
            st.setBasePrice(request.getBasePrice());
            return st;
        }).collect(Collectors.toList());

        List<ShowTime> saved = showTimeRepository.saveAllAndFlush(toSave);
        List<ShowTimeResponse> createdResponses = saved.stream()
                .map(this::toShowTimeResponse)
                .collect(Collectors.toList());

        return BulkShowTimeCreateResponse.builder()
                .createdCount(createdResponses.size())
                .skippedCount(result.conflicts().size())
                .created(createdResponses)
                .skipped(result.conflicts())
                .build();
    }

    /**
     * Shared candidate generation logic.
     * Iterates every (room × date × startTime) combination, checks all validation rules,
     * and sorts each candidate into either {@code valid} or {@code conflicts}.
     */
    private CandidateResult buildCandidateResult(
            BulkShowTimeRequest request,
            NormalizedBulkInput input,
            Movie movie,
            Map<Long, CinemaRoom> roomById,
            List<ShowTime> existingShowTimes) {

        int duration = movie.getDurationMinutes();
        List<ShowTimeCandidateDto> valid = new ArrayList<>();
        List<ShowTimeConflictDto> conflicts = new ArrayList<>();
        Map<RoomDateKey, List<ShowTime>> existingByRoomAndDate = existingShowTimes.stream()
                .collect(Collectors.groupingBy(showTime -> new RoomDateKey(
                        showTime.getCinemaRoom().getCinemaRoomId(), showTime.getShowDate())));
        Map<RoomDateKey, LocalTime> lastGeneratedEnd = new HashMap<>();

        for (Long roomId : input.roomIds()) {
            CinemaRoom room = roomById.get(roomId);
            for (LocalDate date = request.getFromDate();
                    !date.isAfter(request.getToDate()); date = date.plusDays(1)) {
                RoomDateKey key = new RoomDateKey(roomId, date);
                for (LocalTime startTime : input.startTimes()) {
                    LocalDateTime endDateTime = LocalDateTime.of(date, startTime).plusMinutes(duration);
                    LocalTime endTime = endDateTime.toLocalTime();
                    String conflictReason = null;

                    // 1. Minimum show date: must be >= today + 3
                    if (room == null) {
                        conflictReason = "Cinema room not found";
                    }
                    // 2. Operating hours: startTime in 08:00–23:00, endTime <= 23:00
                    else if (isOutsideOperatingHours(date, startTime, endDateTime)) {
                        conflictReason = "Showtime falls outside operating hours (08:00–23:00)";
                    }
                    // 3. Room overlap with existing DB records
                    else if (overlapsExisting(
                            existingByRoomAndDate.getOrDefault(key, List.of()), startTime, endTime)) {
                        conflictReason = "Room is already booked for an overlapping showtime";
                    }
                    // 4. Overlap with other newly generated showtimes in this request
                    else if (lastGeneratedEnd.containsKey(key)
                            && startTime.isBefore(lastGeneratedEnd.get(key))) {
                        conflictReason = "Conflict with another generated showtime in this request";
                    }

                    if (conflictReason != null) {
                        conflicts.add(ShowTimeConflictDto.builder()
                                .showDate(date)
                                .startTime(startTime)
                                .endTime(endTime)
                                .cinemaRoomId(roomId)
                                .cinemaRoomName(room != null ? room.getCinemaRoomName() : "Unknown")
                                .reason(conflictReason)
                                .build());
                    } else {
                        valid.add(ShowTimeCandidateDto.builder()
                                .showDate(date)
                                .startTime(startTime)
                                .endTime(endTime)
                                .cinemaRoomId(roomId)
                                .cinemaRoomName(room.getCinemaRoomName())
                                .build());
                        lastGeneratedEnd.put(key, endTime);
                    }
                }
            }
        }
        return new CandidateResult(valid, conflicts);
    }

    private NormalizedBulkInput validateAndNormalizeBulkRequest(BulkShowTimeRequest request) {
        if (request.getFromDate().isAfter(request.getToDate())
                || request.getFromDate().isBefore(LocalDate.now().plusDays(3))) {
            throw new AppException(MovieErrorCode.INVALID_SHOWDATE);
        }

        long daysBetween = ChronoUnit.DAYS.between(request.getFromDate(), request.getToDate());
        if (daysBetween > MAX_BULK_DATE_RANGE_DAYS) {
            throw new AppException(MovieErrorCode.BULK_SHOWTIME_REQUEST_TOO_LARGE);
        }

        List<Long> roomIds = request.getCinemaRoomIds().stream().distinct().sorted().toList();
        List<LocalTime> startTimes = request.getStartTimes().stream()
                .distinct()
                .sorted(Comparator.naturalOrder())
                .toList();
        long totalCandidates = (long) roomIds.size() * (daysBetween + 1) * startTimes.size();
        if (totalCandidates > MAX_BULK_CANDIDATES) {
            throw new AppException(MovieErrorCode.BULK_SHOWTIME_REQUEST_TOO_LARGE);
        }
        return new NormalizedBulkInput(roomIds, startTimes);
    }

    private Map<Long, CinemaRoom> indexRooms(List<CinemaRoom> rooms) {
        Map<Long, CinemaRoom> roomById = new LinkedHashMap<>();
        rooms.forEach(room -> roomById.put(room.getCinemaRoomId(), room));
        return roomById;
    }

    private boolean overlapsExisting(List<ShowTime> existing, LocalTime startTime, LocalTime endTime) {
        return existing.stream().anyMatch(showTime ->
                startTime.isBefore(showTime.getEndTime())
                        && endTime.isAfter(showTime.getStartTime()));
    }

    private boolean isOutsideOperatingHours(
            LocalDate showDate, LocalTime startTime, LocalDateTime endDateTime) {
        LocalDateTime closingDateTime = LocalDateTime.of(showDate, CLOSING_TIME);
        return startTime.isBefore(OPENING_TIME) || endDateTime.isAfter(closingDateTime);
    }

    private LocalTime validateAndCalculateEndTime(
            LocalDate showDate, LocalTime startTime, int durationMinutes) {
        LocalDateTime endDateTime = LocalDateTime.of(showDate, startTime).plusMinutes(durationMinutes);
        if (isOutsideOperatingHours(showDate, startTime, endDateTime)) {
            throw new AppException(MovieErrorCode.INVALID_SHOWTIME);
        }
        return endDateTime.toLocalTime();
    }

    private record NormalizedBulkInput(List<Long> roomIds, List<LocalTime> startTimes) {}

    private record CandidateResult(
            List<ShowTimeCandidateDto> valid,
            List<ShowTimeConflictDto> conflicts) {}

    private record RoomDateKey(Long roomId, LocalDate showDate) {}


    @Transactional
    public ShowTimePricingResponse update(Long id, UpdateShowTimeRequest request) {
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
            validateSchedulableRoom(room);
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
            LocalTime endTime = validateAndCalculateEndTime(
                    showTime.getShowDate(), startTime, showTime.getMovie().getDurationMinutes());
            showTime.setStartTime(startTime);
            showTime.setEndTime(endTime);
        }

        if (request.isBasePricePresent()) {
            showTime.setBasePrice(request.getBasePrice());
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

        // updatedAt được set tự động bởi @PreUpdate
        ShowTime saved = showTimeRepository.save(showTime);
        if (request.isBasePricePresent()) {
            synchronizeUnbookedSeatPrices(saved);
        }
        return toShowTimePricingResponse(saved);
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
        r.setStartAt(s.getStartAt());
        r.setEndAt(s.getEndAt());
        r.setStatus(s.getStatus() != null ? s.getStatus().name() : null);
        if (s.getMovie() != null) {
            r.setMovieId(s.getMovie().getMovieId());
            r.setMovieName(s.getMovie().getOriginalTitle());
        }
        if (s.getCinemaRoom() != null) {
            r.setCinemaRoomId(s.getCinemaRoom().getCinemaRoomId());
            r.setCinemaRoomName(s.getCinemaRoom().getCinemaRoomName());
            if (s.getCinemaRoom().getCluster() != null) {
                r.setClusterId(s.getCinemaRoom().getCluster().getClusterId());
                r.setClusterName(s.getCinemaRoom().getCluster().getClusterName());
            }
        }
        r.setTotalSeats(s.getTotalSeats());
        r.setAvailableSeats(s.getTotalSeats() != null && s.getSoldSeats() != null
                ? s.getTotalSeats() - s.getSoldSeats() : s.getTotalSeats());
        r.setUpdatedAt(s.getUpdatedAt());
        enrichPrices(List.of(r));
        return r;
    }

    private ShowTimePricingResponse toShowTimePricingResponse(ShowTime showTime) {
        ShowTimePricingResponse response = new ShowTimePricingResponse();
        response.setShowTimeId(showTime.getShowTimeId());
        response.setShowDate(showTime.getShowDate());
        response.setStartTime(showTime.getStartTime());
        response.setEndTime(showTime.getEndTime());
        response.setStartAt(showTime.getStartAt());
        response.setEndAt(showTime.getEndAt());
        response.setStatus(showTime.getStatus() != null ? showTime.getStatus().name() : null);
        response.setUpdatedAt(showTime.getUpdatedAt());
        response.setBasePrice(showTime.getBasePrice());
        if (showTime.getMovie() != null) {
            response.setMovieId(showTime.getMovie().getMovieId());
            response.setMovieName(showTime.getMovie().getOriginalTitle());
        }
        if (showTime.getCinemaRoom() != null) {
            response.setCinemaRoomId(showTime.getCinemaRoom().getCinemaRoomId());
            response.setCinemaRoomName(showTime.getCinemaRoom().getCinemaRoomName());
        }
        return response;
    }

    private BigDecimal resolveSeatPrice(ShowTime showTime, Seat seat) {
        if (showTime.getBasePrice() != null) {
            return showTime.getBasePrice();
        }
        return seat.getPrice() != null ? seat.getPrice() : ShowtimePricingDefaults.DEFAULT_SEAT_PRICE;
    }

    private void synchronizeUnbookedSeatPrices(ShowTime showTime) {
        List<ShowtimeSeat> seats = showtimeSeatRepository
                .findByShowTime_ShowTimeId(showTime.getShowTimeId());
        List<ShowtimeSeat> mutableSeats = seats.stream()
                .filter(seat -> seat.getStatus() == ShowtimeSeatStatus.AVAILABLE
                        || seat.getStatus() == ShowtimeSeatStatus.BLOCKED)
                .peek(seat -> seat.setPrice(resolveSeatPrice(showTime, seat.getSeat())))
                .toList();
        if (!mutableSeats.isEmpty()) {
            showtimeSeatRepository.saveAll(mutableSeats);
        }
    }

    private void validateSchedulableRooms(List<Long> requestedRoomIds, Map<Long, CinemaRoom> roomById) {
        if (roomById.size() != requestedRoomIds.size()) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND);
        }
        roomById.values().forEach(this::validateSchedulableRoom);
    }

    private void validateSchedulableRoom(CinemaRoom room) {
        boolean clusterIsActive = room.getCluster() != null
                && room.getCluster().getStatus() == ClusterStatus.ACTIVE;
        boolean roomIsActive = room.getStatus() == CinemaRoomStatus.ACTIVE;
        boolean hasCapacity = room.getTotalSeatCapacity() != null
                && room.getTotalSeatCapacity() > 0;
        boolean hasSellableActiveLayout = roomLayoutRepository
                .findByCinemaRoomCinemaRoomIdAndStatus(room.getCinemaRoomId(), LayoutStatus.ACTIVE)
                .filter(layout -> layout.getPersonCapacity() != null && layout.getPersonCapacity() > 0)
                .filter(layout -> layout.getSellableUnitCount() != null && layout.getSellableUnitCount() > 0)
                .isPresent();

        if (!clusterIsActive || !roomIsActive || !hasCapacity || !hasSellableActiveLayout) {
            throw new AppException(MovieErrorCode.SHOWTIME_ROOM_NOT_SCHEDULABLE);
        }
    }
}
