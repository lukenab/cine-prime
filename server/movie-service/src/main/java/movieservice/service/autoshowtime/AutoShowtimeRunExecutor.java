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
import movieservice.enums.GenerationPartitionStatus;
import movieservice.enums.GenerationSkipReason;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.ScreeningFormatRepository;
import movieservice.repository.ShowtimeGenerationRunRepository;
import movieservice.repository.ShowtimeGenerationSkipRepository;
import movieservice.repository.ShowtimeGenerationPartitionRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

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
    private final ShowtimeGenerationPartitionRepository generationPartitionRepository;
    private final MovieRepository movieRepository;
    private final CinemaClusterRepository cinemaClusterRepository;
    private final CinemaRoomRepository cinemaRoomRepository;
    private final ScreeningFormatRepository screeningFormatRepository;
    private final AutoShowtimeCandidateFactory candidateFactory;
    private final AutoShowtimeCandidateScorer candidateScorer;
    private final AutoShowtimeCandidateSelector candidateSelector;
    private final AutoShowtimePlanValidator planValidator;
    private final SchedulePlanDraftService schedulePlanDraftService;
    private final AutoShowtimeRunStateService runStateService;

    /// Chạy toàn bộ pipeline Factory -> Scorer -> Selector -> Persist cho một generation run đã ACCEPTED.
    public AutoShowtimeExecutionResult execute(Long generationRunId) {
        if (!runStateService.claim(generationRunId)) {
            return generationRunRepository.findByGenerationRunId(generationRunId)
                    .map(this::toResult)
                    .orElseThrow(() -> new AppException(MovieErrorCode.GENERATION_RUN_NOT_FOUND));
        }

        try {
            ShowtimeGenerationRun run = generationRunRepository.findByGenerationRunId(generationRunId)
                    .orElseThrow(() -> new AppException(MovieErrorCode.GENERATION_RUN_NOT_FOUND));
            List<ShowtimeCandidate> rawCandidates = candidateFactory.buildRawCandidates(run);
            List<ShowtimeCandidate> rankedCandidates = candidateScorer.scoreAndRank(run, rawCandidates);
            AutoShowtimeSelectionResult selection = candidateSelector.select(run, rankedCandidates);

            Map<SkipAggregateKey, SkipAggregate> skipAggregates = new LinkedHashMap<>();
            selection.rejectedCandidates().forEach(rejection -> aggregateSkip(skipAggregates, rejection));
            persistSkipAggregates(run, skipAggregates);

            AutoShowtimePlanValidationResult validation = planValidator.validate(
                    run, rankedCandidates, selection.selectedCandidates());
            Long planId = schedulePlanDraftService.createDraftShell(generationRunId, validation)
                    .getSchedulePlanId();

            Map<PartitionKey, List<ShowtimeCandidate>> partitions = selection.selectedCandidates().stream()
                    .collect(java.util.stream.Collectors.groupingBy(
                            PartitionKey::from, LinkedHashMap::new, java.util.stream.Collectors.toList()));
            List<String> technicalFailures = new java.util.ArrayList<>();
            for (Map.Entry<PartitionKey, List<ShowtimeCandidate>> entry : partitions.entrySet()) {
                try {
                    schedulePlanDraftService.persistPartition(planId, entry.getKey().clusterId(),
                            entry.getKey().businessDate(), entry.getValue());
                } catch (RuntimeException exception) {
                    String detail = rootCauseMessage(exception);
                    technicalFailures.add("cluster=%d date=%s: %s".formatted(
                            entry.getKey().clusterId(), entry.getKey().businessDate(), detail));
                    schedulePlanDraftService.recordPartitionFailure(generationRunId,
                            entry.getKey().clusterId(), entry.getKey().businessDate(),
                            "PARTITION_PERSIST_FAILED", detail);
                }
            }

            int succeeded = (int) generationPartitionRepository
                    .countByGenerationRun_GenerationRunIdAndStatus(
                            generationRunId, GenerationPartitionStatus.SUCCEEDED);
            int failed = (int) generationPartitionRepository
                    .countByGenerationRun_GenerationRunIdAndStatus(
                            generationRunId, GenerationPartitionStatus.FAILED);
            int created = generationPartitionRepository.findByGenerationRun_GenerationRunId(generationRunId)
                    .stream().filter(partition -> partition.getStatus() == GenerationPartitionStatus.SUCCEEDED)
                    .mapToInt(partition -> partition.getSlotCount() == null ? 0 : partition.getSlotCount()).sum();

            if (partitions.isEmpty()) {
                failed = 1;
                technicalFailures.add("NO_USABLE_PARTITION: selection produced no draft slots");
            }
            ShowtimeGenerationRun finished = runStateService.finish(generationRunId, rawCandidates.size(),
                    created, selection.rejectedCandidates().size(), succeeded, failed,
                    technicalFailures.isEmpty() ? null : String.join("\n", technicalFailures));
            return toResult(finished);
        } catch (RuntimeException exception) {
            ShowtimeGenerationRun failed = runStateService.fail(generationRunId, rootCauseMessage(exception));
            return toResult(failed);
        }
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

    private record PartitionKey(Long clusterId, java.time.LocalDate businessDate) {
        private static PartitionKey from(ShowtimeCandidate candidate) {
            return new PartitionKey(candidate.getClusterId(), candidate.getShowDate());
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
