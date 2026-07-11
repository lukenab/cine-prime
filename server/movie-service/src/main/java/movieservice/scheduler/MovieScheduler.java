package movieservice.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movieservice.entity.Movie;
import movieservice.enums.MovieStatus;
import movieservice.repository.MovieRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Nightly job chạy 00:05 mỗi ngày.
 * Tự động chuyển trạng thái NOW_SHOWING → ENDED cho các phim
 * có endDate < ngày hôm nay.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MovieScheduler {

    private final MovieRepository movieRepository;

    /**
     * Chạy lúc 00:05 mỗi đêm (cron: giây phút giờ ngày tháng thứ).
     * Tìm tất cả phim NOW_SHOWING có endDate trước ngày hôm nay
     * và chuyển sang ENDED.
     */
    @Scheduled(cron = "0 5 0 * * *")
    @Transactional
    public void autoEndExpiredMovies() {
        LocalDate today = LocalDate.now();
        List<Movie> expired = movieRepository
                .findByStatusAndEndDateBefore(MovieStatus.NOW_SHOWING, today);

        if (expired.isEmpty()) {
            log.debug("[MovieScheduler] No expired movies to end for {}", today);
            return;
        }

        log.info("[MovieScheduler] Auto-ending {} movie(s) with endDate < {}", expired.size(), today);

        for (Movie movie : expired) {
            movie.setStatus(MovieStatus.ENDED);
            movie.setUpdatedBy("SYSTEM");
            log.info("[MovieScheduler] → ENDED: [{}] {}", movie.getMovieId(), movie.getOriginalTitle());
        }

        movieRepository.saveAll(expired);
        log.info("[MovieScheduler] Done. {} movie(s) transitioned to ENDED.", expired.size());
    }
}
