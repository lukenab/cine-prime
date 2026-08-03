package movieservice.scheduler;

import lombok.extern.slf4j.Slf4j;
import movieservice.entity.MovieAvailability;
import movieservice.enums.AvailabilityStatus;
import movieservice.repository.MovieAvailabilityRepository;
import movieservice.lifecycle.LifecycleEventNotifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
            List.of(
                    AvailabilityStatus.PLANNED,
                    AvailabilityStatus.IN_REVIEW,
                    AvailabilityStatus.CHANGES_REQUESTED,
                    AvailabilityStatus.APPROVED,
                    AvailabilityStatus.OPEN,
                    AvailabilityStatus.SUSPENDED);

    private final MovieAvailabilityRepository movieAvailabilityRepository;
    private final Clock businessClock;
    private final LifecycleEventNotifier lifecycleEventNotifier;

    @Autowired
    public MovieScheduler(
            MovieAvailabilityRepository movieAvailabilityRepository,
            LifecycleEventNotifier lifecycleEventNotifier,
            @Value("${movie.lifecycle.time-zone:Asia/Ho_Chi_Minh}") String timeZone) {
        this(movieAvailabilityRepository, Clock.system(ZoneId.of(timeZone)), lifecycleEventNotifier);
    }

    MovieScheduler(
            MovieAvailabilityRepository movieAvailabilityRepository,
            Clock businessClock,
            LifecycleEventNotifier lifecycleEventNotifier) {
        this.movieAvailabilityRepository = movieAvailabilityRepository;
        this.businessClock = businessClock;
        this.lifecycleEventNotifier = lifecycleEventNotifier;
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
        expired.forEach(availability -> notifyChange(availability, "AUTO_CLOSED"));
        log.info("[MovieScheduler] Done. {} availability window(s) transitioned to CLOSED.", expired.size());
    }

    @Scheduled(
            cron = "${movie.lifecycle.open-cron:0 * * * * *}",
            zone = "${movie.lifecycle.time-zone:Asia/Ho_Chi_Minh}")
    @Transactional
    public void autoOpenDueAvailability() {
        LocalDate today = LocalDate.now(businessClock);
        LocalDateTime now = LocalDateTime.now(businessClock);
        List<MovieAvailability> dueToOpen = movieAvailabilityRepository.findDueToOpen(now, today);

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
        dueToOpen.forEach(availability -> notifyChange(availability, "AUTO_OPENED"));
        log.info("[MovieScheduler] Done. {} availability window(s) transitioned to OPEN.",
                dueToOpen.size());
    }

    private void notifyChange(MovieAvailability availability, String action) {
        lifecycleEventNotifier.notifyChange(
                "RELEASE_PLAN",
                availability.getAvailabilityId(),
                availability.getStatus().name(),
                action,
                availability.getMovie().getMovieId(),
                availability.getCluster().getClusterId());
    }
}
