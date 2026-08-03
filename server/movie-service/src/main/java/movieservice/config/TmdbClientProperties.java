package movieservice.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Getter
@Setter
@Validated
@Component
@ConfigurationProperties(prefix = "tmdb.client")
public class TmdbClientProperties {

    @NotNull
    private Duration connectTimeout = Duration.ofSeconds(2);

    @NotNull
    private Duration readTimeout = Duration.ofSeconds(6);

    @Min(1)
    @Max(5)
    private int maxAttempts = 3;

    @NotNull
    private Duration initialBackoff = Duration.ofMillis(250);

    @NotNull
    private Duration maxBackoff = Duration.ofSeconds(2);

    @Min(0)
    @Max(50)
    private int requestsPerSecond = 4;

    @NotNull
    private Duration cacheTtl = Duration.ofMinutes(10);

    @Min(0)
    @Max(10_000)
    private int cacheMaxEntries = 500;
}
