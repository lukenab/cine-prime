package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.ScreeningFormat;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.entity.ShowtimeGenerationSkip;
import movieservice.enums.GenerationRunStatus;
import movieservice.enums.GenerationSkipReason;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.ScreeningFormatRepository;
import movieservice.repository.ShowtimeGenerationRunRepository;
import movieservice.repository.ShowtimeGenerationSkipRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AutoShowtimeRunExecutor {

    private final ShowtimeGenerationRunRepository generationRunRepository;
    private final ShowtimeGenerationSkipRepository generationSkipRepository;
    private final MovieRepository movieRepository;
    private final CinemaClusterRepository cinemaClusterRepository;
    private final CinemaRoomRepository cinemaRoomRepository;
    private final ScreeningFormatRepository screeningFormatRepository;
    private final AutoShowtimeCandidateFactory candidateFactory;
    private final AutoShowtimeCandidateScorer candidateScorer;
    private final AutoShowtimeCandidateSelector candidateSelector;
    private final AutoShowtimePlanValidator planValidator;
    private final VietnameseFilmShareService vietnameseFilmShareService;
    private final SchedulePlanDraftService schedulePlanDraftService;

    /// Chạy toàn bộ pipeline Factory -> Scorer -> Selector -> Persist cho một generation run đã ACCEPTED.
    @Transactional
    public AutoShowtimeExecutionResult execute(Long generationRunId) {
        /// Pessimistic lock biến ACCEPTED -> RUNNING thành thao tác claim atomic giữa nhiều scheduler node.
        ShowtimeGenerationRun run = generationRunRepository.findByGenerationRunIdForUpdate(generationRunId)
                .orElseThrow(() -> new AppException(MovieErrorCode.GENERATION_RUN_NOT_FOUND));

        /// Execute lại run đã hoàn tất chỉ trả summary cũ, tránh tạo thêm showtime trùng.
        if (run.getStatus() != GenerationRunStatus.ACCEPTED) {
            return toResult(run);
        }

        run.setStatus(GenerationRunStatus.RUNNING);
        run.setStartedAt(LocalDateTime.now());

        /// Factory chỉ tạo candidate thỏa availability, room capability và operating-hour cơ bản.
        List<ShowtimeCandidate> rawCandidates = candidateFactory.buildRawCandidates(run);

        /// Scorer gắn score; Selector áp quota, room share và conflict nội bộ giữa candidate.
        List<ShowtimeCandidate> rankedCandidates = vietnameseFilmShareService.prioritize(
                run, candidateScorer.scoreAndRank(run, rawCandidates));
        AutoShowtimeSelectionResult selection = candidateSelector.select(run, rankedCandidates);

        int createdCount = 0;
        int skippedCount = 0;
        Map<SkipAggregateKey, SkipAggregate> skipAggregates = new LinkedHashMap<>();

        /// Persist audit cho những candidate đã bị Selector loại trước khi chạm database conflict check.
        for (AutoShowtimeCandidateRejection rejection : selection.rejectedCandidates()) {
            aggregateSkip(skipAggregates, rejection);
            skippedCount++;
        }

        // Generation produces a reviewable draft. Only the publish command materializes ShowTime rows.
        AutoShowtimePlanValidationResult validation = planValidator.validate(
                run, rankedCandidates, selection.selectedCandidates())
                .plus(vietnameseFilmShareService.validate(run, selection.selectedCandidates()));
        schedulePlanDraftService.createDraft(
                run.getGenerationRunId(), selection.selectedCandidates(), validation);
        createdCount = selection.selectedCandidates().size();

        persistSkipAggregates(run, skipAggregates);

        run.setCandidateCount(rawCandidates.size());
        run.setCreatedCount(createdCount);
        run.setSkippedCount(skippedCount);
        run.setCompletedAt(LocalDateTime.now());
        /// Candidate bị skip vì quota/conflict là kết quả allocation hợp lệ, không phải lỗi run.
        /// Vì engine đã xử lý hết candidate, trạng thái terminal phải là COMPLETED; chi tiết skip nằm ở skippedCount/skip table.
        run.setStatus(GenerationRunStatus.COMPLETED);

        return toResult(run);
    }

    /// Lưu skip với các FK còn tồn tại; nếu entity đã bị xoá thì để null đúng theo ON DELETE SET NULL của V36.
    /// Gộp theo movie + cluster + reason; không gộp toàn hệ thống để vẫn audit được phạm vi gây skip.
    private void aggregateSkip(
            Map<SkipAggregateKey, SkipAggregate> skipAggregates,
            AutoShowtimeCandidateRejection rejection
    ) {
        SkipAggregateKey key = SkipAggregateKey.from(rejection);
        skipAggregates.compute(key, (ignored, aggregate) -> {
            if (aggregate == null) {
                return new SkipAggregate(rejection);
            }
            aggregate.increment();
            return aggregate;
        });
    }

    /// Chỉ ghi một row cho từng group sau khi engine xử lý hết candidate của run.
    private void persistSkipAggregates(
            ShowtimeGenerationRun run,
            Map<SkipAggregateKey, SkipAggregate> skipAggregates
    ) {
        skipAggregates.values().forEach(aggregate -> persistSkipAggregate(run, aggregate));
    }

    private void persistSkipAggregate(
            ShowtimeGenerationRun run,
            SkipAggregate aggregate
    ) {
        AutoShowtimeCandidateRejection rejection = aggregate.representative();
        ShowtimeCandidate candidate = rejection.candidate();

        ShowtimeGenerationSkip skip = ShowtimeGenerationSkip.builder()
                .generationRun(run)
                .movies(findMovie(candidate.getMovieId()))
                .cluster(findCluster(candidate.getClusterId()))
                .cinemaRoom(findRoom(candidate.getCinemaRoomId()))
                .screeningFormat(findFormat(candidate.getFormatId()))
                .showDate(candidate.getShowDate())
                .startTime(candidate.getStartTime())
                .reason(rejection.reason())
                .detail(rejection.detail())
                .occurrenceCount(aggregate.occurrenceCount())
                .build();

        generationSkipRepository.save(skip);
    }

    private Movie findMovie(Long movieId) {
        return movieRepository.findById(movieId).orElse(null);
    }

    private CinemaCluster findCluster(Long clusterId) {
        return cinemaClusterRepository.findById(clusterId).orElse(null);
    }

    private CinemaRoom findRoom(Long roomId) {
        return cinemaRoomRepository.findById(roomId).orElse(null);
    }

    private ScreeningFormat findFormat(Integer formatId) {
        return screeningFormatRepository.findById(formatId).orElse(null);
    }

    private AutoShowtimeExecutionResult toResult(ShowtimeGenerationRun run) {
        return new AutoShowtimeExecutionResult(
                run.getGenerationRunId(),
                run.getStatus().name(),
                run.getCandidateCount(),
                run.getCreatedCount(),
                run.getSkippedCount()
        );
    }

    /// Lưu nguyên nhân sâu nhất để audit phân biệt overlap constraint với lỗi FK/not-null khi runtime.
    private String rootCauseMessage(Throwable exception) {
        Throwable rootCause = exception;
        while (rootCause.getCause() != null) {
            rootCause = rootCause.getCause();
        }
        return rootCause.getMessage();
    }

    private record SkipAggregateKey(
            Long movieId,
            Long clusterId,
            GenerationSkipReason reason
    ) {
        private static SkipAggregateKey from(AutoShowtimeCandidateRejection rejection) {
            ShowtimeCandidate candidate = rejection.candidate();
            return new SkipAggregateKey(
                    candidate.getMovieId(),
                    candidate.getClusterId(),
                    rejection.reason()
            );
        }
    }

    /// Candidate đầu tiên là mẫu debug; occurrenceCount giữ số lượng skip thật của cả group.
    private static final class SkipAggregate {
        private final AutoShowtimeCandidateRejection representative;
        private int occurrenceCount = 1;

        private SkipAggregate(AutoShowtimeCandidateRejection representative) {
            this.representative = representative;
        }

        private void increment() {
            occurrenceCount++;
        }

        private AutoShowtimeCandidateRejection representative() {
            return representative;
        }

        private int occurrenceCount() {
            return occurrenceCount;
        }
    }
}
