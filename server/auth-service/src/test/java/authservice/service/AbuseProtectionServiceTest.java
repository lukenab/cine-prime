package authservice.service;

import movie.theater.common.exception.AppException;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import java.util.HashMap;
import java.util.Map;

class AbuseProtectionServiceTest {

    @Test
    void rejectsOtpVerificationAfterFiveAttempts() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        Map<String, Long> counters = new HashMap<>();
        when(values.increment(anyString())).thenAnswer(invocation ->
                counters.merge(invocation.getArgument(0), 1L, Long::sum));
        AbuseProtectionService service = new AbuseProtectionService(redis);

        for (int attempt = 0; attempt < 5; attempt++) {
            service.guardOtpVerification("person@example.com");
        }

        assertThatThrownBy(() -> service.guardOtpVerification("person@example.com"))
                .isInstanceOf(AppException.class);
    }
}
