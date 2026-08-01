package movieservice.scheduler;

import lombok.extern.slf4j.Slf4j;
import movieservice.entity.MovieAvailability;
import movieservice.enums.AvailabilityStatus;
import movieservice.repository.MovieAvailabilityRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
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
public class MovieScheduler {

    private static final List<AvailabilityStatus> CLOSEABLE =
            List.of(AvailabilityStatus.PLANNED, AvailabilityStatus.OPEN, AvailabilityStatus.SUSPENDED);

    private final MovieAvailabilityRepository movieAvailabilityRepository;
    private final Clock businessClock;

    @Autowired
    public MovieScheduler(
            MovieAvailabilityRepository movieAvailabilityRepository,
            @Value("${movie.lifecycle.time-zone:Asia/Ho_Chi_Minh}") String timeZone) {
        this(movieAvailabilityRepository, Clock.system(ZoneId.of(timeZone)));
    }

    MovieScheduler(MovieAvailabilityRepository movieAvailabilityRepository, Clock businessClock) {
        this.movieAvailabilityRepository = movieAvailabilityRepository;
        this.businessClock = businessClock;
    }

    @Scheduled(
            cron = "${movie.lifecycle.close-cron:0 5 0 * * *}",
            zone = "${movie.lifecycle.time-zone:Asia/Ho_Chi_Minh}")
    @Transactional
    public void autoCloseExpiredAvailability() {
        LocalDate today = LocalDate.now(businessClock);
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

    @Scheduled(
            cron = "${movie.lifecycle.open-cron:0 10 0 * * *}",
            zone = "${movie.lifecycle.time-zone:Asia/Ho_Chi_Minh}")
    @Transactional
    public void autoOpenDueAvailability() {
        LocalDate today = LocalDate.now(businessClock);
        List<MovieAvailability> dueToOpen = movieAvailabilityRepository.findDueToOpen(today);

        if (dueToOpen.isEmpty()) {
            log.debug("[MovieScheduler] No release-plan windows to open for {}", today);
            return;
        }

        log.info("[MovieScheduler] Opening {} release-plan window(s) for business date {}",
                dueToOpen.size(), today);

        for (MovieAvailability availability : dueToOpen) {
            availability.setStatus(AvailabilityStatus.OPEN);
            availability.setUpdatedBy("SYSTEM");
            log.info("[MovieScheduler] -> OPEN: availability {} (movie {}, cluster {})",
                    availability.getAvailabilityId(),
                    availability.getMovie().getMovieId(),
                    availability.getCluster().getClusterId());
        }

        movieAvailabilityRepository.saveAll(dueToOpen);
        log.info("[MovieScheduler] Done. {} availability window(s) transitioned to OPEN.",
                dueToOpen.size());
    }
}
