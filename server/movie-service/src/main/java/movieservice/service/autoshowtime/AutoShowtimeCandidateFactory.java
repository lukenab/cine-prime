package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.entity.*;
import movieservice.enums.GenerationReason;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.CinemaRoomFormatRepository;
import movieservice.repository.MovieAvailabilityRepository;
import movieservice.repository.ShowtimeAllocationFormatPriorityRepository;
import org.springframework.boot.autoconfigure.data.redis.RedisConnectionDetails;
import org.springframework.boot.autoconfigure.data.redis.RedisProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AutoShowtimeCandidateFactory {
    private final CinemaClusterRepository cinemaClusterRepository;
    private final CinemaRoomFormatRepository cinemaRoomFormatRepository;
    private final MovieAvailabilityRepository movieAvailabilityRepository;
    private final ShowtimeAllocationFormatPriorityRepository formatPriorityRepository;

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
                        || operatingHour.isClosesNextDay() /// cluster đóng qua ngày mới
                        || operatingHour.getOpensAt() == null /// cluster thiếu giờ mở hoặc đóng
                        || operatingHour.getClosesAt() == null
                ) {
                    continue;
                }

                // Loop qua các movie thuộc scope run
                for (Movie movie : run.getMovies()){
                    /// Kiểm tra movie có được phép chiếu ở : cluster hiện tại, ngày hiện tại
                    boolean schedulable = movieAvailabilityRepository.existsSchedulableForDate(
                            movie.getMovieId(),
                            cluster.getClusterId(),
                            showDate
                    );

                    /// Nếu ko có MovieAvailability hợp lệ, ko tạo candidate cho movie đó tại cluster/ ngày đó
                    if (!schedulable){
                        continue;
                    }

                    /// Format cho movie, có thể có nhiều format 2D, 3D, IMAX
                    List<ScreeningFormat> formats = movie.getFormats().stream().sorted(
                            Comparator.comparing(
                                    (ScreeningFormat format) -> formatPriorityById.getOrDefault(
                                            format.getFormatId(),
                                            0
                                    ) /// Format ko có config priority nhận value là 0
                            )
                                    .reversed()
                    )
                            .toList();

                    /// Loop qua từng format movie hỗ trợ
                    for (ScreeningFormat format : formats) {
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

        return candidates;
    }

    /// Tạo slot thời gian cho một movie+cluster+room+format+ngày
    private List<ShowtimeCandidate> buildRoomTimeSlots(
            ShowtimeGenerationRun run,
            Movie movie,
            CinemaCluster cluster,
            CinemaRoom room,
            ScreeningFormat format,
            LocalDate showDate,
            CinemaClusterOperatingHour operatingHour,
            ShowtimeAllocationPolicy policy
    ) {
        List<ShowtimeCandidate> candidates = new ArrayList<>();

        /// Slot đầu tiên phải đúng giờ mở cửa VD opentAt = 8h
        LocalTime startTime = operatingHour.getOpensAt();

        while (true) {
            /// endtime là giờ phim kế thúc của thực tế
            LocalTime endTime = startTime.plusMinutes(
                    movie.getDurationMinutes()
            );

            ///  Phòng chỉ sẵn sàng sau khi phim kết thúc và hết clean buffer là endTime + cleanup(15p)
            LocalTime roomAvailableAgain = endTime.minusMinutes(
                    policy.getCleanupBufferMinutes()
            );

            ///  Nếu cả phim + cleanup không kịp trước giờ đóng cửa -> break
            if (roomAvailableAgain.isAfter(operatingHour.getClosesAt())){
                break;
            }

            candidates.add(
                    ShowtimeCandidate.builder()
                            .generationRunId(run.getGenerationRunId())
                            .movieId(movie.getMovieId())
                            .clusterId(cluster.getClusterId())
                            .cinemaRoomId(room.getCinemaRoomId())
                            .formatId(format.getFormatId())
                            .showDate(showDate)
                            .startTime(startTime)
                            .endTime(endTime)
                            .score(BigDecimal.ZERO)
                            .generationReason(
                                    GenerationReason.DEMAND_QUOTA_ALLOCATION
                            )
                            .build()
            );

            ///  Chuyển sang slot kế tiếp
            startTime = startTime.plusMinutes(
                    policy.getTimeSlotIntervalMinutes()
            );
        }
        return candidates;
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
