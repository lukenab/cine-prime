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
import movie.theater.common.security.JwtSecurityUtils;
import movieservice.dto.request.BulkShowTimeRequest;
import movieservice.dto.request.BulkUpdateShowTimeStatusRequest;
import movieservice.dto.request.CreateShowTimeRequest;
import movieservice.dto.request.ShowTimeRequest;
import movieservice.dto.request.UpdateShowTimeStatusRequest;
import movieservice.dto.request.UpdateShowTimeRequest;
import movieservice.dto.response.BulkShowTimeCreateResponse;
import movieservice.dto.response.BulkShowTimePreviewResponse;
import movieservice.dto.response.ShowTimeCandidateDto;
import movieservice.dto.response.ShowTimeConflictDto;
import movieservice.dto.response.ShowTimePricingResponse;
import movieservice.dto.response.ShowTimeResponse;
import movieservice.dto.response.LayoutPositionResponse;
import movieservice.dto.response.ShowtimeSeatDto;
import movieservice.dto.response.ShowtimeSeatMapResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.RoomLayout;
import movieservice.entity.RoomLayoutPosition;
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
import movieservice.enums.ShowtimePriceSource;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.repository.RoomLayoutPositionRepository;
import movieservice.util.SeatLayoutUtil;
import movieservice.util.MovieTitleResolver;
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
    RoomLayoutPositionRepository roomLayoutPositionRepository;
    MovieMapper movieMapper;
    ShowtimeInventoryService showtimeInventoryService;
    PriceBookPricingService priceBookPricingService;

    @Transactional(readOnly = true)
    public List<ShowtimeSeatDto> getSeatsByShowtime(Long showtimeId) {
        showTimeRepository.findByShowTimeIdAndStatus(showtimeId, ShowTimeStatus.ON_SALE)
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND));

        List<ShowtimeSeat> seats = showtimeSeatRepository.findByShowTime_ShowTimeId(showtimeId);
        if (seats.isEmpty()) {
            throw new AppException(MovieErrorCode.SHOWTIME_INVENTORY_NOT_MATERIALIZED);
        }

        String currentAccountId = JwtSecurityUtils.getCurrentAccountId();
        return seats.stream().map(seat -> toDto(seat, currentAccountId)).collect(Collectors.toList());
    }

    /**
     * Returns customer-bookable inventory together with the physical geometry
     * of the layout version snapped onto the showtime. The legacy /seats
     * endpoint deliberately remains unchanged for existing consumers.
     */
    @Transactional(readOnly = true)
    public ShowtimeSeatMapResponse getSeatMapByShowtime(Long showtimeId) {
        showTimeRepository.findByShowTimeIdAndStatus(showtimeId, ShowTimeStatus.ON_SALE)
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND));

        List<ShowtimeSeat> seats = showtimeSeatRepository.findByShowTime_ShowTimeId(showtimeId);
        if (seats.isEmpty()) {
            throw new AppException(MovieErrorCode.SHOWTIME_INVENTORY_NOT_MATERIALIZED);
        }

        RoomLayout layout = seats.stream()
                .map(ShowtimeSeat::getRoomLayout)
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);

        List<LayoutPositionResponse> positions = layout == null
                ? List.of()
                : roomLayoutPositionRepository
                        .findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(layout.getRoomLayoutId())
                        .stream()
                        .map(this::toLayoutPositionDto)
                        .toList();

        CinemaRoom room = seats.get(0).getShowTime().getCinemaRoom();
        String currentAccountId = JwtSecurityUtils.getCurrentAccountId();
        return ShowtimeSeatMapResponse.builder()
                .seats(seats.stream().map(seat -> toDto(seat, currentAccountId)).toList())
                .positions(positions)
                .presentationSystem(room.getPresentationSystem())
                .projectionTechnologyCode(room.getProjectionTechnology() == null
                        ? null : room.getProjectionTechnology().getTechCode())
                .audioFormatCode(room.getAudioFormat() == null
                        ? null : room.getAudioFormat().getFormatCode())
                .audioFormatName(room.getAudioFormat() == null
                        ? null : room.getAudioFormat().getFormatName())
                .build();
    }

    private ShowtimeSeatDto toDto(ShowtimeSeat seat, String currentAccountId) {
        String status = "AVAILABLE";
        boolean reservedByMe = false;
        if (seat.getStatus() == ShowtimeSeatStatus.SOLD) {
            status = "BOOKED";
        } else if (seat.getStatus() == ShowtimeSeatStatus.RESERVED) {
            if (seat.getReservedExpiresAt() != null && seat.getReservedExpiresAt().isBefore(LocalDateTime.now())) {
                status = "AVAILABLE"; // lock expired
            } else {
                status = "LOCKED";
                reservedByMe = currentAccountId != null && currentAccountId.equals(seat.getReservedBy());
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
                .seatCode(seat.getSeatCode())
                .seatGroupId(seat.getSeatGroupId())
                .row(row)
                .number(number)
                .type(seat.getSeatType() != null ? seat.getSeatType().name() : null)
                .colSpan(colSpan)
                .aisleAfter(aisleAfter)
                .status(status)
                .price(seat.getPrice())
                .reservedByMe(reservedByMe)
                .build();
    }

    private LayoutPositionResponse toLayoutPositionDto(RoomLayoutPosition position) {
        return LayoutPositionResponse.builder()
                .positionId(position.getPositionId())
                .rowIndex(position.getRowIndex())
                .columnIndex(position.getColumnIndex())
                .rowLabel(position.getRowLabel())
                .positionType(position.getPositionType().name())
                .seatNumber(position.getSeatNumber())
                .seatCode(position.getSeatCode())
                .seatType(position.getSeatType() == null ? null : position.getSeatType().name())
                .seatGroupId(position.getSeatGroupId())
                // Non-seat geometry (aisle, exit and empty space) deliberately
                // has no seat status. Keep it null instead of failing the whole
                // customer seat-map response.
                .seatStatus(position.getSeatStatus() == null
                        ? null
                        : position.getSeatStatus().name())
                .manualOverride(position.getManualOverride())
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

    @Transactional(readOnly = true)
    public List<ShowTimeResponse> getAll() {
        List<ShowTimeResponse> responses = movieMapper.toShowTimeResponseList(showTimeRepository.findAll());
        enrichPrices(responses);
        return responses;
    }

    /**
     * Public catalogue boundary: only sessions whose sale lifecycle is ON_SALE are
     * discoverable. The response intentionally keeps the existing DTO contract while
     * preventing SCHEDULED/SUSPENDED/internal rows from being enumerated.
     */
    @Transactional(readOnly = true)
    public List<ShowTimeResponse> getPublicOnSale() {
        return movieMapper.toShowTimeResponseList(
                showTimeRepository.findAllByStatusOrderByShowDateAscStartTimeAsc(ShowTimeStatus.ON_SALE));
    }

    @Transactional(readOnly = true)
    public ShowTimeResponse getById(Long id) {
        ShowTime showTime = showTimeRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND));
        ShowTimeResponse response = movieMapper.toShowTimeResponse(showTime);
        enrichPrices(List.of(response));
        return response;
    }

    @Transactional(readOnly = true)
    public ShowTimeResponse getPublicOnSaleById(Long id) {
        ShowTime showTime = showTimeRepository
                .findByShowTimeIdAndStatus(id, ShowTimeStatus.ON_SALE)
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND));
        return movieMapper.toShowTimeResponse(showTime);
    }

    @Transactional(readOnly = true)
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

    @Transactional(readOnly = true)
    public List<ShowTimeResponse> getPublicOnSaleByMovieId(Long movieId, LocalDate date) {
        if (!movieRepository.existsById(movieId)) {
            throw new AppException(MovieErrorCode.MOVIE_NOT_FOUND);
        }
        List<ShowTime> results = date != null
                ? showTimeRepository.findByMovieMovieIdAndShowDateAndStatusOrderByStartTimeAsc(
                        movieId, date, ShowTimeStatus.ON_SALE)
                : showTimeRepository.findByMovieMovieIdAndStatusOrderByShowDateAscStartTimeAsc(
                        movieId, ShowTimeStatus.ON_SALE);
        return movieMapper.toShowTimeResponseList(results);
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

        // 2. Room exists - locked (PESSIMISTIC_WRITE) for the rest of this transaction so a
        // concurrent create/update targeting the same room is serialized behind this one
        // instead of racing it. Without this lock, two overlapping requests can both run the
        // overlap check below, both see "no conflict" (default READ COMMITTED isolation does
        // not prevent this), and both commit - producing a real overlap despite the check.
        CinemaRoom room = cinemaRoomRepository.findByIdForUpdate(request.getCinemaRoomId())
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));
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
        showTime.setPriceSource(request.getBasePrice() == null
                ? ShowtimePriceSource.ROOM_DEFAULT
                : ShowtimePriceSource.SHOWTIME_OVERRIDE);

        ShowTime saved = showTimeRepository.saveAndFlush(showTime);
        showtimeInventoryService.materialize(saved.getShowTimeId());
        return toShowTimePricingResponse(saved);
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
            st.setPriceSource(request.getBasePrice() == null
                    ? ShowtimePriceSource.ROOM_DEFAULT
                    : ShowtimePriceSource.SHOWTIME_OVERRIDE);
            return st;
        }).collect(Collectors.toList());

        List<ShowTime> saved = showTimeRepository.saveAllAndFlush(toSave);
        saved.forEach(showtime ->
                showtimeInventoryService.materialize(showtime.getShowTimeId()));
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
        boolean pricingContextChanged = request.getCinemaRoomId() != null
                || request.getShowDate() != null
                || request.getStartTime() != null
                || request.isBasePricePresent();

        // Apply non-null field updates
        if (request.getMovieId() != null) {
            Movie movie = movieRepository.findById(request.getMovieId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
            showTime.setMovie(movie);
        }

        if (request.getCinemaRoomId() != null) {
            // Locked for the rest of this transaction - see the comment in createStandalone()
            // for why the overlap recheck below needs the room row locked first.
            CinemaRoom room = cinemaRoomRepository.findByIdForUpdate(request.getCinemaRoomId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));
            validateSchedulableRoom(room);
            showTime.setCinemaRoom(room);
        } else if (request.getShowDate() != null || request.getStartTime() != null) {
            // Room isn't changing, but date/time is: lock the existing room anyway so the
            // overlap recheck below can't race with another create/update touching this room.
            cinemaRoomRepository.findByIdForUpdate(showTime.getCinemaRoom().getCinemaRoomId());
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
            if (showTime.getStatus() != null && showTime.getStatus() != ShowTimeStatus.SCHEDULED) {
                throw new AppException(MovieErrorCode.SHOWTIME_PRICE_LOCKED);
            }
            showTime.setBasePrice(request.getBasePrice());
            showTime.setPriceSource(request.getBasePrice() == null
                    ? ShowtimePriceSource.ROOM_DEFAULT
                    : ShowtimePriceSource.SHOWTIME_OVERRIDE);
            showTime.setPriceBook(null);
            showTime.setPriceRate(null);
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
        if (pricingContextChanged && saved.getStatus() == ShowTimeStatus.SCHEDULED) {
            synchronizeUnbookedSeatPrices(saved);
        }
        return toShowTimePricingResponse(saved);
    }

    @Transactional
    public ShowTimeResponse updateStatus(Long id, UpdateShowTimeStatusRequest request, String actor) {
        ShowTime showTime = showTimeRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND));
        applyStatusTransition(showTime, request.status(), request.reason(), actor);
        return toShowTimeResponse(showTimeRepository.save(showTime));
    }

    @Transactional
    public List<ShowTimeResponse> bulkUpdateStatus(
            BulkUpdateShowTimeStatusRequest request,
            String actor) {
        List<Long> ids = request.showtimeIds().stream().distinct().sorted().toList();
        List<ShowTime> showTimes = showTimeRepository.findAllById(ids);
        if (showTimes.size() != ids.size()) {
            throw new AppException(MovieErrorCode.SHOWTIME_NOT_FOUND);
        }
        showTimes.forEach(showTime ->
                applyStatusTransition(showTime, request.status(), request.reason(), actor));
        List<ShowTimeResponse> responses = movieMapper.toShowTimeResponseList(
                showTimeRepository.saveAll(showTimes));
        enrichPrices(responses);
        return responses;
    }

    private void applyStatusTransition(
            ShowTime showTime,
            ShowTimeStatus target,
            String reason,
            String actor) {
        ShowTimeStatus current = showTime.getStatus();
        if (current == target) {
            return;
        }
        if (current == ShowTimeStatus.CANCELLED || current == ShowTimeStatus.COMPLETED) {
            throw new AppException(MovieErrorCode.SHOWTIME_TERMINAL_STATUS);
        }

        boolean allowed = switch (current) {
            case SCHEDULED -> target == ShowTimeStatus.ON_SALE
                    || target == ShowTimeStatus.SUSPENDED
                    || target == ShowTimeStatus.CANCELLED;
            case ON_SALE -> target == ShowTimeStatus.SUSPENDED
                    || target == ShowTimeStatus.CANCELLED;
            case SUSPENDED -> target == ShowTimeStatus.SCHEDULED
                    || target == ShowTimeStatus.ON_SALE
                    || target == ShowTimeStatus.CANCELLED;
            case CANCELLED, COMPLETED -> false;
        };
        if (!allowed) {
            throw new AppException(MovieErrorCode.INVALID_STATUS_TRANSITION);
        }

        if (target == ShowTimeStatus.ON_SALE) {
            showtimeInventoryService.materialize(showTime.getShowTimeId());
        }

        if (target == ShowTimeStatus.CANCELLED) {
            if (reason == null || reason.isBlank()) {
                throw new AppException(MovieErrorCode.SHOWTIME_CANCELLATION_REASON_REQUIRED);
            }
            showTime.setCancellationReason(reason.trim());
            showTime.setCancelledAt(LocalDateTime.now());
            showTime.setCancelledBy(actor);
            List<ShowtimeSeat> seats = showtimeSeatRepository
                    .findByShowTime_ShowTimeId(showTime.getShowTimeId());
            seats.forEach(seat -> {
                seat.setStatus(ShowtimeSeatStatus.CANCELLED);
                seat.setReservedAt(null);
                seat.setReservedExpiresAt(null);
            });
            if (!seats.isEmpty()) {
                showtimeSeatRepository.saveAll(seats);
            }
        }

        showTime.setStatus(target);
        showTime.setUpdatedBy(actor);
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
        r.setScreeningVersionId(s.getScreeningVersion() != null
                ? s.getScreeningVersion().getScreeningVersionId() : null);
        r.setAudioLanguageCode(s.getLanguageCode());
        r.setSubtitleLanguageCode(s.getSubtitleCode());
        r.setStatus(s.getStatus() != null ? s.getStatus().name() : null);
        r.setSource(s.getSource() != null ? s.getSource().name() : null);
        r.setFormatCode(s.getFormat() != null ? s.getFormat().getFormatCode() : null);
        r.setCancellationReason(s.getCancellationReason());
        r.setBasePrice(s.getBasePrice());
        r.setPriceSource(s.getPriceSource() != null ? s.getPriceSource().name() : null);
        r.setPriceBookId(s.getPriceBook() != null ? s.getPriceBook().getPriceBookId() : null);
        r.setPriceRateId(s.getPriceRate() != null ? s.getPriceRate().getPriceRateId() : null);
        if (s.getMovie() != null) {
            r.setMovieId(s.getMovie().getMovieId());
            r.setMovieName(MovieTitleResolver.preferredVietnameseTitle(s.getMovie()));
            r.setMoviePosterUrl(s.getMovie().getPosterUrl());
        }
        if (s.getCinemaRoom() != null) {
            r.setCinemaRoomId(s.getCinemaRoom().getCinemaRoomId());
            r.setCinemaRoomName(s.getCinemaRoom().getCinemaRoomName());
            if (s.getCinemaRoom().getCluster() != null) {
                r.setClusterId(s.getCinemaRoom().getCluster().getClusterId());
                r.setClusterName(s.getCinemaRoom().getCluster().getClusterName());
            }
        }
        int totalSeats = s.getTotalSeats() != null ? s.getTotalSeats() : 0;
        int soldSeats = s.getSoldSeats() != null ? s.getSoldSeats() : 0;
        r.setTotalSeats(totalSeats);
        r.setSoldSeats(soldSeats);
        r.setAvailableSeats(Math.max(0, totalSeats - soldSeats));
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
        response.setPriceSource(showTime.getPriceSource() != null ? showTime.getPriceSource().name() : null);
        response.setPriceBookId(showTime.getPriceBook() != null ? showTime.getPriceBook().getPriceBookId() : null);
        response.setPriceRateId(showTime.getPriceRate() != null ? showTime.getPriceRate().getPriceRateId() : null);
        if (showTime.getMovie() != null) {
            response.setMovieId(showTime.getMovie().getMovieId());
            response.setMovieName(MovieTitleResolver.preferredVietnameseTitle(showTime.getMovie()));
        }
        if (showTime.getCinemaRoom() != null) {
            response.setCinemaRoomId(showTime.getCinemaRoom().getCinemaRoomId());
            response.setCinemaRoomName(showTime.getCinemaRoom().getCinemaRoomName());
        }
        return response;
    }

    private void synchronizeUnbookedSeatPrices(ShowTime showTime) {
        PriceBookPricingService.PricingDecision pricing = priceBookPricingService.resolve(showTime);
        priceBookPricingService.applyDecision(showTime, pricing);
        List<ShowtimeSeat> seats = showtimeSeatRepository
                .findByShowTime_ShowTimeId(showTime.getShowTimeId());
        List<ShowtimeSeat> mutableSeats = seats.stream()
                .filter(seat -> seat.getStatus() == ShowtimeSeatStatus.AVAILABLE
                        || seat.getStatus() == ShowtimeSeatStatus.BLOCKED)
                .peek(seat -> seat.setPrice(pricing.priceFor(seat.getSeat())))
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
