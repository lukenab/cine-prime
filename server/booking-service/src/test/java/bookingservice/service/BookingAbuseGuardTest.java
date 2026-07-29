package bookingservice.service;

import bookingservice.entity.BookingStatus;
import bookingservice.repository.BookingRepository;
import movie.theater.common.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BookingAbuseGuardTest {
    private BookingRepository bookingRepository;
    private StringRedisTemplate redisTemplate;
    private ValueOperations<String, String> valueOperations;
    private BookingAbuseGuard guard;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        bookingRepository = mock(BookingRepository.class);
        redisTemplate = mock(StringRedisTemplate.class);
        valueOperations = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        guard = new BookingAbuseGuard(bookingRepository, redisTemplate);
        ReflectionTestUtils.setField(guard, "maxActivePending", 3);
        ReflectionTestUtils.setField(guard, "maxAttemptsPerMinute", 10);
    }

    @Test
    void shouldRejectWhenCustomerAlreadyHasMaximumActivePendingBookings() {
        when(bookingRepository.countByAccountIdAndStatusAndExpiresAtAfter(
                eq("customer-1"),
                eq(BookingStatus.PENDING_PAYMENT),
                any(OffsetDateTime.class)))
                .thenReturn(3L);

        assertThatThrownBy(() -> guard.checkNewBooking("customer-1"))
                .isInstanceOf(AppException.class);
        verifyNoInteractions(redisTemplate);
    }

    @Test
    void shouldRejectAttemptAboveRedisWindowLimit() {
        when(bookingRepository.countByAccountIdAndStatusAndExpiresAtAfter(
                anyString(), any(), any()))
                .thenReturn(0L);
        when(valueOperations.increment("booking:attempts:customer-1"))
                .thenReturn(11L);

        assertThatThrownBy(() -> guard.checkNewBooking("customer-1"))
                .isInstanceOf(AppException.class);
    }

    @Test
    void shouldFailOpenForRedisOutageWhileDatabaseCapStillPasses() {
        when(bookingRepository.countByAccountIdAndStatusAndExpiresAtAfter(
                anyString(), any(), any()))
                .thenReturn(0L);
        when(valueOperations.increment(anyString()))
                .thenThrow(new IllegalStateException("Redis unavailable"));

        assertThatCode(() -> guard.checkNewBooking("customer-1"))
                .doesNotThrowAnyException();
    }
}
