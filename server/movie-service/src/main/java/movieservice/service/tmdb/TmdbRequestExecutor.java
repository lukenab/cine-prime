package movieservice.service.tmdb;

import movieservice.config.TmdbClientProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.LockSupport;
import java.util.function.LongSupplier;

/**
 * Applies bounded retry, client-side rate limiting and a bounded TTL cache to TMDB GET calls.
 * Failures and null responses are never cached.
 */
public final class TmdbRequestExecutor {

    private final int maxAttempts;
    private final long initialBackoffNanos;
    private final long maxBackoffNanos;
    private final long requestIntervalNanos;
    private final long cacheTtlNanos;
    private final int cacheMaxEntries;
    private final LongSupplier nanoTime;
    private final NanosSleeper sleeper;
    private final Map<CacheKey, CacheEntry> cache = new ConcurrentHashMap<>();
    private final Object rateLimitMonitor = new Object();

    private long nextRequestNanos;

    public TmdbRequestExecutor(TmdbClientProperties properties) {
        this(
                properties,
                System::nanoTime,
                nanos -> {
                    if (nanos > 0) LockSupport.parkNanos(nanos);
                });
    }

    TmdbRequestExecutor(
            TmdbClientProperties properties,
            LongSupplier nanoTime,
            NanosSleeper sleeper) {
        this.maxAttempts = properties.getMaxAttempts();
        this.initialBackoffNanos = nonNegativeNanos(properties.getInitialBackoff());
        this.maxBackoffNanos = nonNegativeNanos(properties.getMaxBackoff());
        this.requestIntervalNanos = properties.getRequestsPerSecond() == 0
                ? 0
                : TimeUnit.SECONDS.toNanos(1) / properties.getRequestsPerSecond();
        this.cacheTtlNanos = nonNegativeNanos(properties.getCacheTtl());
        this.cacheMaxEntries = properties.getCacheMaxEntries();
        this.nanoTime = nanoTime;
        this.sleeper = sleeper;
    }

    public <T> T get(RestTemplate restTemplate, URI uri, Class<T> responseType) {
        CacheKey cacheKey = new CacheKey(uri, responseType);
        T cached = getCached(cacheKey, responseType);
        if (cached != null) return cached;

        RestClientException lastFailure = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            acquireRateLimitPermit();
            try {
                T response = restTemplate.getForObject(uri, responseType);
                if (response != null) putCached(cacheKey, response);
                return response;
            } catch (RestClientException failure) {
                lastFailure = failure;
                if (!isRetryable(failure) || attempt == maxAttempts) throw failure;
                sleeper.sleep(retryDelayNanos(failure, attempt));
            }
        }
        throw lastFailure;
    }

    int cacheSize() {
        return cache.size();
    }

    private void acquireRateLimitPermit() {
        if (requestIntervalNanos <= 0) return;

        long waitNanos;
        synchronized (rateLimitMonitor) {
            long now = nanoTime.getAsLong();
            long scheduled = Math.max(now, nextRequestNanos);
            waitNanos = Math.max(0, scheduled - now);
            nextRequestNanos = saturatedAdd(scheduled, requestIntervalNanos);
        }
        sleeper.sleep(waitNanos);
    }

    private boolean isRetryable(RestClientException failure) {
        if (failure instanceof ResourceAccessException) return true;
        if (failure instanceof HttpStatusCodeException statusFailure) {
            HttpStatusCode status = statusFailure.getStatusCode();
            return status.value() == 429 || status.is5xxServerError();
        }
        return false;
    }

    private long retryDelayNanos(RestClientException failure, int attempt) {
        if (failure instanceof HttpStatusCodeException statusFailure
                && statusFailure.getStatusCode().value() == 429) {
            long retryAfter = retryAfterNanos(statusFailure.getResponseHeaders());
            if (retryAfter >= 0) return Math.min(retryAfter, maxBackoffNanos);
        }

        int shift = Math.min(30, Math.max(0, attempt - 1));
        long multiplier = 1L << shift;
        long exponential = initialBackoffNanos > Long.MAX_VALUE / multiplier
                ? Long.MAX_VALUE
                : initialBackoffNanos * multiplier;
        return Math.min(exponential, maxBackoffNanos);
    }

    private long retryAfterNanos(HttpHeaders headers) {
        if (headers == null) return -1;
        String raw = headers.getFirst(HttpHeaders.RETRY_AFTER);
        if (raw == null || raw.isBlank()) return -1;
        try {
            return TimeUnit.SECONDS.toNanos(Math.max(0, Long.parseLong(raw.trim())));
        } catch (NumberFormatException ignored) {
            return -1;
        }
    }

    private <T> T getCached(CacheKey key, Class<T> responseType) {
        if (cacheTtlNanos <= 0 || cacheMaxEntries <= 0) return null;
        CacheEntry entry = cache.get(key);
        if (entry == null) return null;
        if (entry.expiresAtNanos() <= nanoTime.getAsLong()) {
            cache.remove(key, entry);
            return null;
        }
        return responseType.cast(entry.response());
    }

    private void putCached(CacheKey key, Object response) {
        if (cacheTtlNanos <= 0 || cacheMaxEntries <= 0) return;
        long now = nanoTime.getAsLong();
        evictExpired(now);
        if (cache.size() >= cacheMaxEntries) {
            cache.keySet().stream().findFirst().ifPresent(cache::remove);
        }
        cache.put(key, new CacheEntry(response, saturatedAdd(now, cacheTtlNanos)));
    }

    private void evictExpired(long now) {
        cache.entrySet().removeIf(entry -> entry.getValue().expiresAtNanos() <= now);
    }

    private static long nonNegativeNanos(Duration duration) {
        if (duration == null || duration.isNegative() || duration.isZero()) return 0;
        try {
            return duration.toNanos();
        } catch (ArithmeticException ignored) {
            return Long.MAX_VALUE;
        }
    }

    private static long saturatedAdd(long left, long right) {
        if (right > 0 && left > Long.MAX_VALUE - right) return Long.MAX_VALUE;
        return left + right;
    }

    private record CacheKey(URI uri, Class<?> responseType) {
    }

    private record CacheEntry(Object response, long expiresAtNanos) {
    }

    @FunctionalInterface
    interface NanosSleeper {
        void sleep(long nanos);
    }
}
