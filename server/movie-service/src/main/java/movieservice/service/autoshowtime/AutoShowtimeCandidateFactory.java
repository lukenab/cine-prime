package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.entity.*;
import movieservice.enums.GenerationReason;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.CinemaRoomFormatRepository;
import movieservice.repository.MovieScreeningVersionRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeAllocationFormatPriorityRepository;
import movieservice.repository.CinemaRoomMaintenanceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import movieservice.enums.ScreeningVersionStatus;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AutoShowtimeCandidateFactory {
    private static final ZoneId DEFAULT_BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final CinemaClusterRepository cinemaClusterRepository;
    private final CinemaRoomFormatRepository cinemaRoomFormatRepository;
    private final MovieScreeningVersionRepository movieScreeningVersionRepository;
    private final SchedulingEligibilityService schedulingEligibilityService;
    private final ShowtimeAllocationFormatPriorityRepository formatPriorityRepository;
    private final ShowTimeRepository showTimeRepository;
    private final CinemaRoomMaintenanceRepository maintenanceRepository;

    @Transactional(readOnly = true)
    public List<ShowtimeCandidate> buildRawCandidates(ShowtimeGenerationRun run){
        ShowtimeAllocationPolicy policy = run.getPolicy();

        Map<Integer, Integer> formatPriorityById = loadFormatPriorities(policy.getPolicyId());

        List<ShowtimeCandidate> candidates = new ArrayList<>();

        /// Duyệt từng ngày trong scope của generation run,
        /// VD: startDate: 2026-07-22, endDate: 2026-07-28m thì nó sẽ loop chạy tử ngày 22 - 28
        for (LocalDate showDate = run.getStartDate();
             !showDate.isAfter(run.getEndDate());
             showDate = showDate.plusDays(1)){

            /// Duyệt qua các cluster mà được yêu cầu trong generation run
            for (CinemaCluster runCluster : run.getClusters()){
                /// Load lại cluster từ repo, lấy operatingHours
                CinemaCluster cluster =  cinemaClusterRepository
                        .findById(runCluster.getClusterId())
                        .orElseThrow();

                /// Lấy giờ vận hành tương ứng với thứ trong tuần, vd showDate là MONDAY thì row CinemaClusterOperatingHour có dayOfWeek = MONDAY
                CinemaClusterOperatingHour operatingHour = findOperatingHour(cluster, showDate.getDayOfWeek());

                /// Deadline scope: không generate suất qua ngày mới
                if (operatingHour == null
                        || operatingHour.isClosed() /// cluster đóng cửa
                        || operatingHour.getOpensAt() == null /// cluster thiếu giờ mở hoặc đóng
                        || operatingHour.getClosesAt() == null
                ) {
                    continue;
                }

                // Loop qua các movie thuộc scope run
                for (Movie movie : run.getMovies()){
                    /// Format cho movie, có thể có nhiều format 2D, 3D, IMAX
                    List<MovieScreeningVersion> versions = movieScreeningVersionRepository
                            .findEffectiveVersions(movie.getMovieId(), showDate, ScreeningVersionStatus.ACTIVE)
                            .stream().sorted(
                            Comparator.comparing(
                                    (MovieScreeningVersion version) -> formatPriorityById.getOrDefault(
                                            version.getFormat().getFormatId(),
                                            0
                                    )
                            )
                                    .reversed()
                            ).toList();

                    for (MovieScreeningVersion version : versions) {
                        if (!schedulingEligibilityService
                                .evaluate(movie, cluster, version, showDate)
                                .eligible()) {
                            continue;
                        }
                        ScreeningFormat format = version.getFormat();
                        List<CinemaRoom> rooms = cinemaRoomFormatRepository.findEligibleActiveRoomsByMovieIdAndFormatId(
                                movie.getMovieId(),
                                format.getFormatId()
                        );

                        /// Khi mà query room thì có thể trả room nhiều cluster nên lọc thêm để chỉ dùng cho room thuộc cluster hiện tại
                        for (CinemaRoom room : rooms) {
                            if (!room.getCluster().getClusterId().equals(cluster.getClusterId())){
                                continue;
                            }

                            /// Với một combination thì movie+cluster+room+format+date -> tạo tất cả slot hợp lệ trong operating Hour
                            candidates.addAll(
                                    buildRoomTimeSlots(
                                            run,
                                            movie,
                                            cluster,
                                            room,
                                            format,
                                            version,
                                            showDate,
                                            operatingHour,
                                            policy
                                    )
                            );
                        }
                    }
                }
            }
        }

        List<ShowtimeCandidate> withoutMaintenance = removeCandidatesConflictingWithMaintenance(candidates, run);
        return removeCandidatesConflictingWithExistingShowtimes(withoutMaintenance, run, policy);
    }

    /**
     * Maintenance is stored as a local operational window. Load it once for the whole run and
     * filter in memory instead of issuing one database query for every generated candidate.
     */
    private List<ShowtimeCandidate> removeCandidatesConflictingWithMaintenance(
            List<ShowtimeCandidate> candidates,
            ShowtimeGenerationRun run
    ) {
        if (candidates.isEmpty()) {
            return candidates;
        }

        List<Long> roomIds = candidates.stream()
                .map(ShowtimeCandidate::getCinemaRoomId)
                .distinct()
                .toList();
        LocalDateTime fromInclusive = run.getStartDate().minusDays(1).atStartOfDay();
        LocalDateTime toExclusive = run.getEndDate().plusDays(2).atStartOfDay();

        Map<Long, List<CinemaRoomMaintenance>> maintenanceByRoom = new HashMap<>();
        maintenanceRepository.findBlockingMaintenanceInRange(roomIds, fromInclusive, toExclusive)
                .forEach(maintenance -> maintenanceByRoom
                        .computeIfAbsent(
                                maintenance.getCinemaRoom().getCinemaRoomId(),
                                ignored -> new ArrayList<>())
                        .add(maintenance));

        return candidates.stream().filter(candidate -> maintenanceByRoom
                .getOrDefault(candidate.getCinemaRoomId(), List.of())
                .stream()
                .noneMatch(maintenance -> overlapsMaintenance(candidate, maintenance)))
                .toList();
    }

    private boolean overlapsMaintenance(
            ShowtimeCandidate candidate,
            CinemaRoomMaintenance maintenance
    ) {
        String timezone = maintenance.getCinemaRoom().getCluster().getTimezone();
        ZoneId zone = timezone == null ? DEFAULT_BUSINESS_ZONE : ZoneId.of(timezone);
        LocalDateTime candidateStart = candidate.temporalStartAt()
                .atZoneSameInstant(zone).toLocalDateTime();
        LocalDateTime candidateEnd = candidate.temporalEndAt()
                .atZoneSameInstant(zone).toLocalDateTime();
        LocalDateTime maintenanceEnd = maintenance.getResolvedAt();

        return maintenance.getStartedAt().isBefore(candidateEnd)
                && (maintenanceEnd == null || maintenanceEnd.isAfter(candidateStart));
    }

    /// Tạo slot thời gian cho một movie+cluster+room+format+ngày
    private List<ShowtimeCandidate> buildRoomTimeSlots(
            ShowtimeGenerationRun run,
            Movie movie,
            CinemaCluster cluster,
            CinemaRoom room,
            ScreeningFormat format,
            MovieScreeningVersion screeningVersion,
            LocalDate showDate,
            CinemaClusterOperatingHour operatingHour,
            ShowtimeAllocationPolicy policy
    ) {
        List<ShowtimeCandidate> candidates = new ArrayList<>();

        /// Slot đầu tiên phải đúng giờ mở cửa VD opentAt = 8h
        ZoneId businessZone = cluster.getTimezone() == null
                ? DEFAULT_BUSINESS_ZONE
                : ZoneId.of(cluster.getTimezone());
        ZonedDateTime startAt = ZonedDateTime.of(showDate, operatingHour.getOpensAt(), businessZone);
        ZonedDateTime closingAt = ZonedDateTime.of(showDate, operatingHour.getClosesAt(), businessZone);
        if (operatingHour.isClosesNextDay() || !closingAt.isAfter(startAt)) {
            closingAt = closingAt.plusDays(1);
        }

        while (true) {
            /// endtime là giờ phim kế thúc của thực tế
            ZonedDateTime endAt = startAt.plusMinutes(movie.getDurationMinutes());

            /// Phòng chỉ sẵn sàng sau khi phim kết thúc và hết cleanup buffer.
            /// Dùng LocalDateTime để không bị sai khi endTime + buffer đi qua mốc nửa đêm.
            ZonedDateTime roomAvailableAgain = endAt.plusMinutes(policy.getCleanupBufferMinutes());

            ///  Nếu cả phim + cleanup không kịp trước giờ đóng cửa -> break
            if (roomAvailableAgain.isAfter(closingAt)){
                break;
            }

            OffsetDateTime candidateStartAt = startAt.toOffsetDateTime();
            OffsetDateTime candidateEndAt = endAt.toOffsetDateTime();

            candidates.add(
                    ShowtimeCandidate.builder()
                            .generationRunId(run.getGenerationRunId())
                            .movieId(movie.getMovieId())
                            .clusterId(cluster.getClusterId())
                            .cinemaRoomId(room.getCinemaRoomId())
                            .formatId(format.getFormatId())
                            .screeningVersionId(screeningVersion.getScreeningVersionId())
                            .showDate(showDate)
                            .startTime(candidateStartAt.toLocalTime())
                            .endTime(candidateEndAt.toLocalTime())
                            .startAt(candidateStartAt)
                            .endAt(candidateEndAt)
                            .score(BigDecimal.ZERO)
                            .generationReason(
                                    GenerationReason.DEMAND_QUOTA_ALLOCATION
                            )
                            .build()
            );

            ///  Chuyển sang slot kế tiếp
            startAt = startAt.plusMinutes(policy.getTimeSlotIntervalMinutes());
        }
        return candidates;
    }

    /// Lấy toàn bộ showtime đang hoạt động trong scope bằng một query, rồi loại candidate đã xung đột
    /// trước khi chấm điểm/chọn quota. Persistence vẫn kiểm tra lần cuối để chống race condition.
    private List<ShowtimeCandidate> removeCandidatesConflictingWithExistingShowtimes(
            List<ShowtimeCandidate> candidates,
            ShowtimeGenerationRun run,
            ShowtimeAllocationPolicy policy
    ) {
        if (candidates.isEmpty()) {
            return candidates;
        }

        List<Long> roomIds = candidates.stream()
                .map(ShowtimeCandidate::getCinemaRoomId)
                .distinct()
                .toList();

        // Query a deliberately broad UTC envelope. A run may contain clusters in different
        // timezones, including UTC+14, so a single Asia/Ho_Chi_Minh boundary can miss the
        // first local hours of the planning date.
        OffsetDateTime fromInclusive = run.getStartDate().minusDays(1)
                .atStartOfDay(ZoneOffset.UTC)
                .toOffsetDateTime();
        OffsetDateTime toExclusive = run.getEndDate().plusDays(2)
                .atStartOfDay(ZoneOffset.UTC)
                .toOffsetDateTime();
        Map<Long, List<ShowTime>> existingShowtimesByRoom = new HashMap<>();
        showTimeRepository.findActiveByRoomsAndTemporalRange(roomIds, fromInclusive, toExclusive)
                .forEach(showtime -> existingShowtimesByRoom
                        .computeIfAbsent(showtime.getCinemaRoom().getCinemaRoomId(), ignored -> new ArrayList<>())
                        .add(showtime));

        return candidates.stream()
                .filter(candidate -> !hasExistingShowtimeConflict(
                        candidate,
                        existingShowtimesByRoom.getOrDefault(candidate.getCinemaRoomId(), List.of()),
                        policy.getCleanupBufferMinutes()
                ))
                .toList();
    }

    /// Hai khoảng thời gian không được chồng lên nhau sau khi mỗi suất cộng cleanup buffer.
    private boolean hasExistingShowtimeConflict(
            ShowtimeCandidate candidate,
            List<ShowTime> existingShowtimes,
            Integer cleanupBufferMinutes
    ) {
        OffsetDateTime candidateStart = candidate.temporalStartAt();
        OffsetDateTime candidateAvailableAgain = candidate.temporalEndAt()
                .plusMinutes(cleanupBufferMinutes);

        return existingShowtimes.stream().anyMatch(existing -> {
            OffsetDateTime existingStart = existing.getStartAt();
            OffsetDateTime existingAvailableAgain = existing.getEndAt()
                    .plusMinutes(cleanupBufferMinutes);

            return candidateStart.isBefore(existingAvailableAgain)
                    && existingStart.isBefore(candidateAvailableAgain);
        });
    }

    ///  Lấy giờ vận hành của cluster cho một thứ cụ thể VD: dayOfWeek = MONDAY -> return về record MONDAY của cluster đó
    private CinemaClusterOperatingHour findOperatingHour(CinemaCluster cluster, DayOfWeek dayOfWeek){
        return cluster.getOperatingHours().stream()
                .filter(hour -> hour.getDayOfWeek() == dayOfWeek)
                .findFirst()
                .orElse(null);
    }

    private Map<Integer, Integer> loadFormatPriorities (Long policyId){
        Map<Integer, Integer> result = new HashMap<>();

        formatPriorityRepository
                .findAllByPolicyIdWithFormat(policyId)
                .forEach(prioity -> result.put(
                        prioity.getScreeningFormat().getFormatId(),
                        prioity.getAllocationPriority()
                ));

        return result;
    }

}
