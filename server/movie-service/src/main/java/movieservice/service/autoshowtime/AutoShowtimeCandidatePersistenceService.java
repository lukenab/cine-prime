package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.MovieScreeningVersion;
import movieservice.entity.ScreeningFormat;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.GenerationReason;
import movieservice.enums.GenerationSkipReason;
import movieservice.enums.ShowTimeStatus;
import movieservice.enums.ShowtimePriceSource;
import movieservice.enums.ShowtimeSource;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.MovieScreeningVersionRepository;
import movieservice.repository.ScreeningFormatRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeGenerationRunRepository;
import movieservice.service.PriceBookPricingService;
import movieservice.service.ShowtimeInventoryService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AutoShowtimeCandidatePersistenceService {

    private final CinemaRoomRepository cinemaRoomRepository;
    private final MovieRepository movieRepository;
    private final MovieScreeningVersionRepository movieScreeningVersionRepository;
    private final ScreeningFormatRepository screeningFormatRepository;
    private final ShowtimeGenerationRunRepository generationRunRepository;
    private final ShowTimeRepository showTimeRepository;
    private final SchedulingOperationalConstraintService operationalConstraintService;
    private final PriceBookPricingService priceBookPricingService;
    private final ShowtimeInventoryService showtimeInventoryService;

    /// Mỗi candidate chạy transaction độc lập để conflict của một suất không rollback cả generation run.
    @Transactional
    public AutoShowtimePersistenceResult persist(
            Long generationRunId,
            ShowtimeCandidate candidate,
            Integer cleanupBufferMinutes
    ) {
        /// Lock room trước khi kiểm tra conflict để hai node không cùng chèn suất vào cùng một phòng.
        CinemaRoom room = cinemaRoomRepository.findAllByIdForUpdate(List.of(candidate.getCinemaRoomId()))
                .stream()
                .findFirst()
                .orElse(null);

        if (room == null) {
            return AutoShowtimePersistenceResult.rejected(reject(candidate, GenerationSkipReason.NO_ELIGIBLE_ROOM,
                    "Cinema room no longer exists when the candidate is persisted."));
        }

        MovieScreeningVersion screeningVersion = movieScreeningVersionRepository
                .getReferenceById(candidate.getScreeningVersionId());
        SchedulingEligibilityResult operationalEligibility = operationalConstraintService.evaluate(
                room, screeningVersion, candidate.temporalStartAt(), candidate.temporalEndAt());
        if (!operationalEligibility.eligible()) {
            return AutoShowtimePersistenceResult.rejected(reject(candidate,
                    mapOperationalSkipReason(operationalEligibility.reasonCodes()),
                    "Operational eligibility changed: "
                            + String.join(",", operationalEligibility.reasonCodes())));
        }

        /// Check actual overlap trước để audit phân biệt conflict showtime thật với cleanup buffer conflict.
        if (showTimeRepository.existsByCinemaRoomAndOverlappingWindow(
                room.getCinemaRoomId(),
                candidate.temporalStartAt(),
                candidate.temporalEndAt()
        )) {
            return AutoShowtimePersistenceResult.rejected(reject(candidate, GenerationSkipReason.EXISTING_SHOWTIME_CONFLICT,
                    "An existing non-cancelled showtime overlaps this candidate."));
        }

        /// Check thêm cleanup buffer vì DB exclusion constraint chỉ bảo vệ actual start/end time.
        if (showTimeRepository.existsByCinemaRoomAndCleanupBufferWindowConflict(
                room.getCinemaRoomId(),
                candidate.temporalStartAt(),
                candidate.temporalEndAt(),
                cleanupBufferMinutes
        )) {
            return AutoShowtimePersistenceResult.rejected(reject(candidate, GenerationSkipReason.CLEANUP_BUFFER_CONFLICT,
                    "Candidate conflicts with an existing showtime after cleanup buffer is applied."));
        }

        /// getReferenceById chỉ tạo JPA reference; candidate đã được Factory validate từ trước.
        Movie movie = movieRepository.getReferenceById(candidate.getMovieId());
        ScreeningFormat format = screeningFormatRepository.getReferenceById(candidate.getFormatId());
        ShowtimeGenerationRun run = generationRunRepository.getReferenceById(generationRunId);

        ShowTime showTime = ShowTime.builder()
                .movie(movie)
                .cinemaRoom(room)
                /// Showtime.format phải là format đã được candidate chọn, không suy ra từ RoomType.
                .format(format)
                .screeningVersion(screeningVersion)
                .showDate(candidate.getShowDate())
                .startTime(candidate.getStartTime())
                .endTime(candidate.getEndTime())
                .startAt(candidate.temporalStartAt())
                .endAt(candidate.temporalEndAt())
                .languageCode(screeningVersion.getAudioLanguageCode())
                .subtitleCode(screeningVersion.getSubtitleLanguageCode())
                /// Không hardcode giá; lấy base seat price thấp nhất đã cấu hình trong room.
                .priceSource(ShowtimePriceSource.ROOM_DEFAULT)
                .totalSeats(room.getTotalSeatCapacity())
                .status(ShowTimeStatus.SCHEDULED)
                .source(ShowtimeSource.AUTO)
                .generationRun(run)
                .generationReason(candidate.getGenerationReason())
                .createdBy("AUTO_SCHEDULER")
                .updatedBy("AUTO_SCHEDULER")
                .build();

        // Resolve commercial pricing before the first INSERT. The database keeps
        // show_time.base_price NOT NULL, while materialization happens only after
        // the showtime has been persisted.
        PriceBookPricingService.PricingDecision pricing =
                priceBookPricingService.resolveForSlot(
                        room,
                        candidate.getShowDate(),
                        candidate.getStartTime(),
                        format);
        priceBookPricingService.applyDecision(showTime, pricing);

        /// saveAndFlush để DB exclusion constraint phát hiện race condition ngay tại candidate này.
        ShowTime persisted = showTimeRepository.saveAndFlush(showTime);
        showtimeInventoryService.materialize(persisted.getShowTimeId());
        return AutoShowtimePersistenceResult.created(persisted);
    }

    private GenerationSkipReason mapOperationalSkipReason(List<String> reasonCodes) {
        if (reasonCodes.contains(SchedulingOperationalConstraintService.ROOM_MAINTENANCE_CONFLICT)) {
            return GenerationSkipReason.ROOM_MAINTENANCE_CONFLICT;
        }
        if (reasonCodes.contains(SchedulingOperationalConstraintService.ROOM_LAYOUT_NOT_ACTIVE)
                || reasonCodes.contains(SchedulingOperationalConstraintService.ROOM_CAPACITY_NOT_SELLABLE)) {
            return GenerationSkipReason.ROOM_LAYOUT_NOT_ACTIVE;
        }
        return GenerationSkipReason.NO_ELIGIBLE_ROOM;
    }

    /// Base price ưu tiên giá seat rẻ nhất; room chưa có seat config dùng default chung của module.
    private AutoShowtimeCandidateRejection reject(
            ShowtimeCandidate candidate,
            GenerationSkipReason reason,
            String detail
    ) {
        return new AutoShowtimeCandidateRejection(candidate, reason, detail);
    }
}
