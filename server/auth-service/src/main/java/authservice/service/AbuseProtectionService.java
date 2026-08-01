package authservice.service;

import authservice.exception.AuthErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
@Slf4j
public class AbuseProtectionService {

    private final StringRedisTemplate redisTemplate;

    public void guardLogin(String username) {
        consume("login:ip:" + fingerprint(clientIp()), 30, Duration.ofMinutes(15));
        consume("login:user:" + fingerprint(normalize(username)), 10, Duration.ofMinutes(15));
    }

    public void loginSucceeded(String username) {
        delete("login:user:" + fingerprint(normalize(username)));
    }

    public void guardRegistration(String email) {
        consume("register:ip:" + fingerprint(clientIp()), 15, Duration.ofHours(1));
        consume("register:email:" + fingerprint(normalize(email)), 5, Duration.ofHours(1));
    }

    public void guardAvailabilityCheck() {
        consume("availability:ip:" + fingerprint(clientIp()), 30, Duration.ofMinutes(10));
    }

    public void guardOtpVerification(String email) {
        consume("otp:ip:" + fingerprint(clientIp()), 30, Duration.ofMinutes(10));
        consume("otp:email:" + fingerprint(normalize(email)), 5, Duration.ofMinutes(10));
    }

    public void otpVerified(String email) {
        delete("otp:email:" + fingerprint(normalize(email)));
    }

    private void consume(String suffix, int limit, Duration window) {
        String key = "abuse:" + suffix;
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1) {
                redisTemplate.expire(key, window);
            }
            if (count != null && count > limit) {
                throw new AppException(AuthErrorCode.RATE_LIMIT_EXCEEDED);
            }
        } catch (AppException exception) {
            throw exception;
        } catch (RuntimeException redisFailure) {
            // Account-level lockout remains active if Redis is temporarily unavailable.
            log.warn("Rate-limit store unavailable; continuing with account lockout protection", redisFailure);
        }
    }

    private void delete(String suffix) {
        try {
            redisTemplate.delete("abuse:" + suffix);
        } catch (RuntimeException redisFailure) {
            log.warn("Could not clear rate-limit counter", redisFailure);
        }
    }

    private String clientIp() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            HttpServletRequest request = attributes.getRequest();
            return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
        }
        return "unknown";
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    private String fingerprint(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }
}
