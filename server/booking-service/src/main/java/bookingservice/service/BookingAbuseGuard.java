package bookingservice.service;

import bookingservice.entity.BookingStatus;
import bookingservice.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;

import static bookingservice.exception.BookingErrorCode.BOOKING_RATE_LIMITED;
import static bookingservice.exception.BookingErrorCode.TOO_MANY_ACTIVE_BOOKINGS;

@Service
@RequiredArgsConstructor
public class BookingAbuseGuard {
    private static final Duration ATTEMPT_WINDOW = Duration.ofMinutes(1);

    private final BookingRepository bookingRepository;
    private final StringRedisTemplate redisTemplate;

    @Value("${booking.abuse.max-active-pending:3}")
    private int maxActivePending;

    @Value("${booking.abuse.max-attempts-per-minute:10}")
    private int maxAttemptsPerMinute;

    public void checkNewBooking(String accountId) {
        long activePending = bookingRepository.countByAccountIdAndStatusAndExpiresAtAfter(
                accountId,
                BookingStatus.PENDING_PAYMENT,
                OffsetDateTime.now());
        if (activePending >= maxActivePending) {
            throw new AppException(TOO_MANY_ACTIVE_BOOKINGS);
        }

        // Redis is a fast abuse-control layer, not a booking correctness dependency.
        // If it is temporarily unavailable, the database-backed active-booking cap remains enforced.
        try {
            String key = "booking:attempts:" + accountId;
            Long attempts = redisTemplate.opsForValue().increment(key);
            if (attempts != null && attempts == 1L) {
                redisTemplate.expire(key, ATTEMPT_WINDOW);
            }
            if (attempts != null && attempts > maxAttemptsPerMinute) {
                throw new AppException(BOOKING_RATE_LIMITED);
            }
        } catch (AppException exception) {
            throw exception;
        } catch (RuntimeException ignored) {
            // Fail open for infrastructure availability; never fail open for the database cap above.
        }
    }
}
