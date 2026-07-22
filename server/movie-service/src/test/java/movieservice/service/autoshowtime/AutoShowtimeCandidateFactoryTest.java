package movieservice.service.autoshowtime;

import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaClusterOperatingHour;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.MovieScreeningVersion;
import movieservice.entity.ScreeningFormat;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.CinemaRoomFormatRepository;
import movieservice.repository.MovieScreeningVersionRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeAllocationFormatPriorityRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import movieservice.enums.ScreeningVersionStatus;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AutoShowtimeCandidateFactoryTest {

    private static final LocalDate SHOW_DATE = LocalDate.of(2026, 7, 27);

    @Mock CinemaClusterRepository cinemaClusterRepository;
    @Mock CinemaRoomFormatRepository cinemaRoomFormatRepository;
    @Mock MovieScreeningVersionRepository movieScreeningVersionRepository;
    @Mock SchedulingEligibilityService schedulingEligibilityService;
    @Mock ShowtimeAllocationFormatPriorityRepository formatPriorityRepository;
    @Mock ShowTimeRepository showTimeRepository;

    private AutoShowtimeCandidateFactory factory;
    private CinemaCluster cluster;
    private CinemaRoom room;
    private Movie movie;

    @BeforeEach
    void setUp() {
        factory = new AutoShowtimeCandidateFactory(
                cinemaClusterRepository,
                cinemaRoomFormatRepository,
                movieScreeningVersionRepository,
                schedulingEligibilityService,
                formatPriorityRepository,
                showTimeRepository
        );

        cluster = CinemaCluster.builder().clusterId(1L).timezone("Asia/Ho_Chi_Minh").build();
        room = CinemaRoom.builder().cinemaRoomId(10L).cluster(cluster).totalSeatCapacity(100).build();
        movie = Movie.builder()
                .movieId(1L)
                .durationMinutes(60)
                .formats(List.of(ScreeningFormat.builder().formatId(1).build()))
                .build();
        MovieScreeningVersion version = MovieScreeningVersion.builder()
                .screeningVersionId(100L)
                .movie(movie)
                .format(movie.getFormats().getFirst())
                .audioLanguageCode("en")
                .status(ScreeningVersionStatus.ACTIVE)
                .build();

        when(cinemaClusterRepository.findById(1L)).thenReturn(Optional.of(cluster));
        when(schedulingEligibilityService.evaluate(any(), any(), any(), any()))
                .thenReturn(SchedulingEligibilityResult.allowed());
        when(movieScreeningVersionRepository.findEffectiveVersions(anyLong(), any(), any()))
                .thenReturn(List.of(version));
        when(cinemaRoomFormatRepository.findEligibleActiveRoomsByMovieIdAndFormatId(anyLong(), anyInt()))
                .thenReturn(List.of(room));
        when(formatPriorityRepository.findAllByPolicyIdWithFormat(1L)).thenReturn(List.of());
    }

    @Test
    void buildRawCandidatesStopsWhenMovieAndCleanupWouldPassClosingTime() {
        cluster.setOperatingHours(List.of(operatingHour(LocalTime.of(8, 0), LocalTime.of(10, 0))));
        when(showTimeRepository.findActiveByRoomsAndTemporalRange(any(), any(), any())).thenReturn(List.of());

        List<ShowtimeCandidate> candidates = factory.buildRawCandidates(run(15));

        /// 08:00-09:00 + 15 phút cleanup hợp lệ; slot 08:15-09:15 cũng hợp lệ,
        /// còn mọi slot có endTime + cleanup sau 10:00 phải không được tạo.
        assertEquals(4, candidates.size());
        assertEquals(LocalTime.of(8, 45), candidates.getLast().getStartTime());
        assertEquals(LocalTime.of(9, 45), candidates.getLast().getEndTime());
    }

    @Test
    void buildRawCandidatesFiltersManualConflictButKeepsAlternativeSlot() {
        cluster.setOperatingHours(List.of(operatingHour(LocalTime.of(8, 0), LocalTime.of(12, 0))));
        ShowTime manualShowtime = ShowTime.builder()
                .cinemaRoom(room)
                .showDate(SHOW_DATE)
                .startTime(LocalTime.of(9, 30))
                .endTime(LocalTime.of(10, 30))
                .build();
        manualShowtime.synchronizeTemporalWindow();
        when(showTimeRepository.findActiveByRoomsAndTemporalRange(any(), any(), any()))
                .thenReturn(List.of(manualShowtime));

        List<ShowtimeCandidate> candidates = factory.buildRawCandidates(run(60));

        /// Slot 08:00 vẫn dùng được. Slot 09:00 và 10:00 bị loại vì đụng suất manual
        /// khi tính cả cleanup buffer, để selector có thể chọn slot thay thế thay vì skip lúc persist.
        assertEquals(List.of(LocalTime.of(8, 0)), candidates.stream()
                .map(ShowtimeCandidate::getStartTime)
                .toList());
    }

    private ShowtimeGenerationRun run(int timeSlotIntervalMinutes) {
        return ShowtimeGenerationRun.builder()
                .generationRunId(1L)
                .policy(ShowtimeAllocationPolicy.builder()
                        .policyId(1L)
                        .cleanupBufferMinutes(15)
                        .timeSlotIntervalMinutes(timeSlotIntervalMinutes)
                        .build())
                .startDate(SHOW_DATE)
                .endDate(SHOW_DATE)
                .movies(Set.of(movie))
                .clusters(Set.of(cluster))
                .build();
    }

    private CinemaClusterOperatingHour operatingHour(LocalTime opensAt, LocalTime closesAt) {
        return CinemaClusterOperatingHour.builder()
                .dayOfWeek(DayOfWeek.MONDAY)
                .opensAt(opensAt)
                .closesAt(closesAt)
                .closed(false)
                .closesNextDay(false)
                .build();
    }
}
