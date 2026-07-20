package movieservice.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movieservice.entity.MovieAvailability;
import movieservice.enums.AvailabilityStatus;
import movieservice.repository.MovieAvailabilityRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Nightly job at 00:05. Auto-closes MovieAvailability windows whose
 * showing_end_date has passed — this used to flip Movie.status straight to
 * ENDED, which conflated exhibition end with content archival. Movie.status
 * (content) is untouched here; a movie stays APPROVED after every one of its
 * availability windows closes, until an admin explicitly archives it.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MovieScheduler {

    private static final List<AvailabilityStatus> CLOSEABLE =
            List.of(AvailabilityStatus.PLANNED, AvailabilityStatus.OPEN, AvailabilityStatus.SUSPENDED);

    private final MovieAvailabilityRepository movieAvailabilityRepository;

    @Scheduled(cron = "0 5 0 * * *")
    @Transactional
    public void autoCloseExpiredAvailability() {
        LocalDate today = LocalDate.now();
        List<MovieAvailability> expired = movieAvailabilityRepository
                .findByStatusInAndShowingEndDateBefore(CLOSEABLE, today);

        if (expired.isEmpty()) {
            log.debug("[MovieScheduler] No expired availability windows to close for {}", today);
            return;
        }

        log.info("[MovieScheduler] Auto-closing {} availability window(s) with showing_end_date < {}", expired.size(), today);

        for (MovieAvailability availability : expired) {
            availability.setStatus(AvailabilityStatus.CLOSED);
            availability.setUpdatedBy("SYSTEM");
            log.info("[MovieScheduler] → CLOSED: availability {} (movie {})",
                    availability.getAvailabilityId(), availability.getMovie().getMovieId());
        }

        movieAvailabilityRepository.saveAll(expired);
        log.info("[MovieScheduler] Done. {} availability window(s) transitioned to CLOSED.", expired.size());
    }
}
