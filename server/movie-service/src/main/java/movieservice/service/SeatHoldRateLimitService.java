package movieservice.service;

import java.time.Clock;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import movieservice.config.SeatHoldProperties;
import movie.theater.common.exception.AppException;
import movieservice.exception.MovieErrorCode;

@Service
@RequiredArgsConstructor
public class SeatHoldRateLimitService {

    private final JdbcTemplate jdbcTemplate;
    private final SeatHoldProperties properties;
    private final Clock clock;

    @Transactional(propagation = Propagation.MANDATORY)
    public void check(String accountId, String clientIp, Long showtimeId) {
        long windowSeconds = Math.max(1, properties.getRateLimit().getWindow().toSeconds());
        long windowEpoch = clock.instant().getEpochSecond() / windowSeconds;
        consume("ACCOUNT", accountId, windowEpoch, properties.getRateLimit().getAccount());
        consume("IP", clientIp == null || clientIp.isBlank() ? "unknown" : clientIp,
                windowEpoch, properties.getRateLimit().getIp());
        consume("SHOWTIME", String.valueOf(showtimeId), windowEpoch, properties.getRateLimit().getShowtime());
    }

    private void consume(String type, String key, long windowEpoch, int limit) {
        Integer count = jdbcTemplate.queryForObject("""
                INSERT INTO seat_hold_rate_window
                    (dimension_type, dimension_key, window_epoch, request_count, updated_at)
                VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT (dimension_type, dimension_key, window_epoch)
                DO UPDATE SET request_count = seat_hold_rate_window.request_count + 1,
                              updated_at = CURRENT_TIMESTAMP
                RETURNING request_count
                """, Integer.class, type, key, windowEpoch);
        if (count != null && count > limit) {
            throw new AppException(MovieErrorCode.SEAT_HOLD_RATE_LIMITED);
        }
    }

    @Transactional
    public int deleteOldWindows() {
        long cutoff = clock.instant().minus(properties.getRateLimit().getWindow().multipliedBy(3)).getEpochSecond();
        return jdbcTemplate.update(
                "DELETE FROM seat_hold_rate_window WHERE window_epoch < ?",
                cutoff / Math.max(1, properties.getRateLimit().getWindow().toSeconds()));
    }
}
