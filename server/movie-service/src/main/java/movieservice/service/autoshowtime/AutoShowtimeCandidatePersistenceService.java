package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.MovieScreeningVersion;
import movieservice.entity.ScreeningFormat;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.GenerationReason;
import movieservice.enums.GenerationSkipReason;
import movieservice.enums.ShowTimeStatus;
import movieservice.enums.ShowtimeSource;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.MovieScreeningVersionRepository;
import movieservice.repository.ScreeningFormatRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeGenerationRunRepository;
import movieservice.service.ShowtimePricingDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AutoShowtimeCandidatePersistenceService {

    private final CinemaRoomRepository cinemaRoomRepository;
    private final MovieRepository movieRepository;
    private final MovieScreeningVersionRepository movieScreeningVersionRepository;
    private final ScreeningFormatRepository screeningFormatRepository;
    private final ShowtimeGenerationRunRepository generationRunRepository;
    private final ShowTimeRepository showTimeRepository;

    /// Mỗi candidate chạy transaction độc lập để conflict của một suất không rollback cả generation run.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<AutoShowtimeCandidateRejection> persist(
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
            return Optional.of(reject(candidate, GenerationSkipReason.NO_ELIGIBLE_ROOM,
                    "Cinema room no longer exists when the candidate is persisted."));
        }

        /// Check actual overlap trước để audit phân biệt conflict showtime thật với cleanup buffer conflict.
        if (showTimeRepository.existsByCinemaRoomAndOverlappingWindow(
                room.getCinemaRoomId(),
                candidate.temporalStartAt(),
                candidate.temporalEndAt()
        )) {
            return Optional.of(reject(candidate, GenerationSkipReason.EXISTING_SHOWTIME_CONFLICT,
                    "An existing non-cancelled showtime overlaps this candidate."));
        }

        /// Check thêm cleanup buffer vì DB exclusion constraint chỉ bảo vệ actual start/end time.
        if (showTimeRepository.existsByCinemaRoomAndCleanupBufferWindowConflict(
                room.getCinemaRoomId(),
                candidate.temporalStartAt(),
                candidate.temporalEndAt(),
                cleanupBufferMinutes
        )) {
            return Optional.of(reject(candidate, GenerationSkipReason.CLEANUP_BUFFER_CONFLICT,
                    "Candidate conflicts with an existing showtime after cleanup buffer is applied."));
        }

        /// getReferenceById chỉ tạo JPA reference; candidate đã được Factory validate từ trước.
        Movie movie = movieRepository.getReferenceById(candidate.getMovieId());
        ScreeningFormat format = screeningFormatRepository.getReferenceById(candidate.getFormatId());
        MovieScreeningVersion screeningVersion = movieScreeningVersionRepository
                .getReferenceById(candidate.getScreeningVersionId());
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
                .basePrice(resolveBasePrice(room))
                .totalSeats(room.getTotalSeatCapacity())
                .status(ShowTimeStatus.SCHEDULED)
                .source(ShowtimeSource.AUTO)
                .generationRun(run)
                .generationReason(candidate.getGenerationReason())
                .createdBy("AUTO_SCHEDULER")
                .updatedBy("AUTO_SCHEDULER")
                .build();

        /// saveAndFlush để DB exclusion constraint phát hiện race condition ngay tại candidate này.
        showTimeRepository.saveAndFlush(showTime);
        return Optional.empty();
    }

    /// Base price ưu tiên giá seat rẻ nhất; room chưa có seat config dùng default chung của module.
    private BigDecimal resolveBasePrice(CinemaRoom room) {
        return Optional.ofNullable(room.getSeats())
                .orElseGet(List::of)
                .stream()
                .map(Seat::getPrice)
                .filter(Objects::nonNull)
                .min(BigDecimal::compareTo)
                .orElse(ShowtimePricingDefaults.DEFAULT_SEAT_PRICE);
    }

    private AutoShowtimeCandidateRejection reject(
            ShowtimeCandidate candidate,
            GenerationSkipReason reason,
            String detail
    ) {
        return new AutoShowtimeCandidateRejection(candidate, reason, detail);
    }
}
