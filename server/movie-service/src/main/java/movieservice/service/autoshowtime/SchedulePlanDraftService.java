package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.entity.*;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.*;
import movieservice.enums.GenerationPartitionStatus;
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
public class SchedulePlanDraftService {
    private final SchedulePlanRepository schedulePlanRepository;
    private final ShowtimeGenerationRunRepository generationRunRepository;
    private final MovieRepository movieRepository;
    private final CinemaRoomRepository cinemaRoomRepository;
    private final MovieScreeningVersionRepository screeningVersionRepository;
    private final ShowtimeGenerationPartitionRepository partitionRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SchedulePlan createDraftShell(Long generationRunId,
                                         AutoShowtimePlanValidationResult validation) {
        Optional<SchedulePlan> existing = schedulePlanRepository
                .findByGenerationRun_GenerationRunId(generationRunId);
        if (existing.isPresent()) {
            SchedulePlan plan = existing.get();
            plan.setBlockerCount(validation.blockers().size());
            plan.setValidationSummary(validation.summary());
            return plan;
        }

        ShowtimeGenerationRun run = generationRunRepository.findById(generationRunId)
                .orElseThrow(() -> new AppException(MovieErrorCode.GENERATION_RUN_NOT_FOUND));
        SchedulePlan plan = SchedulePlan.builder()
                .generationRun(run)
                .blockerCount(validation.blockers().size())
                .validationSummary(validation.summary())
                .build();

        return schedulePlanRepository.save(plan);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int persistPartition(Long schedulePlanId, Long clusterId,
                                java.time.LocalDate businessDate,
                                List<ShowtimeCandidate> candidates) {
        Optional<ShowtimeGenerationPartition> previous = partitionRepository
                .findByGenerationRun_GenerationRunIdAndClusterIdAndBusinessDate(
                        planRunId(schedulePlanId), clusterId, businessDate);
        if (previous.filter(partition -> partition.getStatus() == GenerationPartitionStatus.SUCCEEDED)
                .isPresent()) {
            return previous.get().getSlotCount();
        }

        SchedulePlan plan = schedulePlanRepository.findById(schedulePlanId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SCHEDULE_PLAN_NOT_FOUND));
        for (ShowtimeCandidate candidate : candidates) {
            CinemaRoom room = cinemaRoomRepository.findById(candidate.getCinemaRoomId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));
            Movie movie = movieRepository.getReferenceById(candidate.getMovieId());
            MovieScreeningVersion version = screeningVersionRepository
                    .getReferenceById(candidate.getScreeningVersionId());

            plan.addSlot(SchedulePlanSlot.builder()
                    .movie(movie)
                    .cinemaRoom(room)
                    .screeningVersion(version)
                    .startAt(candidate.temporalStartAt())
                    .endAt(candidate.temporalEndAt())
                    .businessDate(candidate.getShowDate())
                    .basePrice(resolveBasePrice(room))
                    .totalSeats(room.getTotalSeatCapacity())
                    .generationReason(candidate.getGenerationReason())
                    .build());
        }
        schedulePlanRepository.saveAndFlush(plan);

        ShowtimeGenerationPartition partition = previous.orElseGet(() -> ShowtimeGenerationPartition.builder()
                .generationRun(plan.getGenerationRun()).clusterId(clusterId).businessDate(businessDate).build());
        partition.setStatus(GenerationPartitionStatus.SUCCEEDED);
        partition.setSlotCount(candidates.size());
        partition.setFailureCode(null);
        partition.setFailureDetail(null);
        partition.setAttemptCount(previous.map(value -> value.getAttemptCount() + 1).orElse(1));
        partitionRepository.save(partition);
        return candidates.size();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordPartitionFailure(Long generationRunId, Long clusterId,
                                       java.time.LocalDate businessDate,
                                       String failureCode, String failureDetail) {
        ShowtimeGenerationPartition partition = partitionRepository
                .findByGenerationRun_GenerationRunIdAndClusterIdAndBusinessDate(
                        generationRunId, clusterId, businessDate)
                .orElseGet(() -> ShowtimeGenerationPartition.builder()
                        .generationRun(generationRunRepository.getReferenceById(generationRunId))
                        .clusterId(clusterId).businessDate(businessDate).build());
        partition.setStatus(GenerationPartitionStatus.FAILED);
        partition.setSlotCount(0);
        partition.setFailureCode(failureCode);
        partition.setFailureDetail(failureDetail);
        partition.setAttemptCount(partition.getPartitionId() == null ? 1 : partition.getAttemptCount() + 1);
        partitionRepository.save(partition);
    }

    private Long planRunId(Long schedulePlanId) {
        return schedulePlanRepository.findById(schedulePlanId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SCHEDULE_PLAN_NOT_FOUND))
                .getGenerationRun().getGenerationRunId();
    }

    private BigDecimal resolveBasePrice(CinemaRoom room) {
        return Optional.ofNullable(room.getSeats()).orElseGet(List::of).stream()
                .map(Seat::getPrice)
                .filter(Objects::nonNull)
                .min(BigDecimal::compareTo)
                .orElse(ShowtimePricingDefaults.DEFAULT_SEAT_PRICE);
    }
}
