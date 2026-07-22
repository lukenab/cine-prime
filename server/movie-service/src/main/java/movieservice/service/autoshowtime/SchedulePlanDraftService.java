package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.entity.*;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.*;
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

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SchedulePlan createDraft(Long generationRunId, List<ShowtimeCandidate> candidates) {
        Optional<SchedulePlan> existing = schedulePlanRepository
                .findByGenerationRun_GenerationRunId(generationRunId);
        if (existing.isPresent()) {
            return existing.get();
        }

        ShowtimeGenerationRun run = generationRunRepository.findById(generationRunId)
                .orElseThrow(() -> new AppException(MovieErrorCode.GENERATION_RUN_NOT_FOUND));
        SchedulePlan plan = SchedulePlan.builder().generationRun(run).build();

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
        return schedulePlanRepository.save(plan);
    }

    private BigDecimal resolveBasePrice(CinemaRoom room) {
        return Optional.ofNullable(room.getSeats()).orElseGet(List::of).stream()
                .map(Seat::getPrice)
                .filter(Objects::nonNull)
                .min(BigDecimal::compareTo)
                .orElse(ShowtimePricingDefaults.DEFAULT_SEAT_PRICE);
    }
}

