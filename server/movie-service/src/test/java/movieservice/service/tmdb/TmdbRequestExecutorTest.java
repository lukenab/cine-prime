package movieservice.service.tmdb;

import movieservice.config.TmdbClientProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TmdbRequestExecutorTest {

    private RestTemplate restTemplate;
    private TmdbClientProperties properties;
    private AtomicLong nanoTime;
    private List<Long> sleeps;

    @BeforeEach
    void setUp() {
        restTemplate = mock(RestTemplate.class);
        properties = new TmdbClientProperties();
        properties.setRequestsPerSecond(0);
        properties.setInitialBackoff(Duration.ofMillis(100));
        properties.setMaxBackoff(Duration.ofSeconds(2));
        properties.setCacheTtl(Duration.ofSeconds(10));
        properties.setCacheMaxEntries(10);
        nanoTime = new AtomicLong();
        sleeps = new ArrayList<>();
    }

    @Test
    void retries429AndHonorsRetryAfterWithoutCachingFailure() {
        URI uri = URI.create("https://example.test/search");
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.RETRY_AFTER, "1");
        HttpClientErrorException rateLimited = HttpClientErrorException.create(
                HttpStatus.TOO_MANY_REQUESTS, "rate limited", headers,
                new byte[0], StandardCharsets.UTF_8);
        when(restTemplate.getForObject(uri, String.class))
                .thenThrow(rateLimited)
                .thenReturn("ok");

        TmdbRequestExecutor executor = executorAdvancingTimeWhenSleeping();

        assertEquals("ok", executor.get(restTemplate, uri, String.class));
        assertEquals(List.of(TimeUnit.SECONDS.toNanos(1)), sleeps);
        verify(restTemplate, times(2)).getForObject(uri, String.class);
    }

    @Test
    void retriesNetworkTimeoutWithBoundedExponentialBackoff() {
        URI uri = URI.create("https://example.test/movie/1");
        when(restTemplate.getForObject(uri, String.class))
                .thenThrow(new ResourceAccessException("read timed out"))
                .thenThrow(new ResourceAccessException("read timed out"))
                .thenReturn("movie");

        TmdbRequestExecutor executor = executorAdvancingTimeWhenSleeping();

        assertEquals("movie", executor.get(restTemplate, uri, String.class));
        assertEquals(List.of(
                TimeUnit.MILLISECONDS.toNanos(100),
                TimeUnit.MILLISECONDS.toNanos(200)), sleeps);
    }

    @Test
    void doesNotRetryNonRetryable4xxResponse() {
        URI uri = URI.create("https://example.test/movie/missing");
        HttpClientErrorException notFound = HttpClientErrorException.create(
                HttpStatus.NOT_FOUND, "not found", HttpHeaders.EMPTY,
                new byte[0], StandardCharsets.UTF_8);
        when(restTemplate.getForObject(uri, String.class)).thenThrow(notFound);

        TmdbRequestExecutor executor = executorAdvancingTimeWhenSleeping();

        assertThrows(HttpClientErrorException.class,
                () -> executor.get(restTemplate, uri, String.class));
        verify(restTemplate).getForObject(uri, String.class);
        assertEquals(List.of(), sleeps);
    }

    @Test
    void returnsCachedResponseUntilTtlExpires() {
        URI uri = URI.create("https://example.test/configuration");
        when(restTemplate.getForObject(uri, String.class))
                .thenReturn("v1")
                .thenReturn("v2");
        TmdbRequestExecutor executor = executorAdvancingTimeWhenSleeping();

        assertEquals("v1", executor.get(restTemplate, uri, String.class));
        nanoTime.addAndGet(TimeUnit.SECONDS.toNanos(9));
        assertEquals("v1", executor.get(restTemplate, uri, String.class));
        nanoTime.addAndGet(TimeUnit.SECONDS.toNanos(2));
        assertEquals("v2", executor.get(restTemplate, uri, String.class));

        verify(restTemplate, times(2)).getForObject(uri, String.class);
    }

    @Test
    void spacesRequestsAccordingToConfiguredRateLimit() {
        properties.setRequestsPerSecond(4);
        properties.setCacheTtl(Duration.ZERO);
        TmdbRequestExecutor executor = executorAdvancingTimeWhenSleeping();
        URI first = URI.create("https://example.test/one");
        URI second = URI.create("https://example.test/two");
        when(restTemplate.getForObject(first, String.class)).thenReturn("one");
        when(restTemplate.getForObject(second, String.class)).thenReturn("two");

        executor.get(restTemplate, first, String.class);
        executor.get(restTemplate, second, String.class);

        assertEquals(List.of(0L, TimeUnit.MILLISECONDS.toNanos(250)), sleeps);
    }

    private TmdbRequestExecutor executorAdvancingTimeWhenSleeping() {
        return new TmdbRequestExecutor(properties, nanoTime::get, nanos -> {
            sleeps.add(nanos);
            nanoTime.addAndGet(nanos);
        });
    }
}
