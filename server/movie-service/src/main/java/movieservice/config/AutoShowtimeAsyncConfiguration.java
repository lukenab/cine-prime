package movieservice.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

@Configuration
public class AutoShowtimeAsyncConfiguration {

    /** Dedicated, bounded worker pool for automatic showtime generation. */
    @Bean(name = "autoShowtimeTaskExecutor")
    public Executor autoShowtimeTaskExecutor(
            @Value("${auto-showtime.worker.core-pool-size:2}") int corePoolSize,
            @Value("${auto-showtime.worker.max-pool-size:4}") int maxPoolSize,
            @Value("${auto-showtime.worker.queue-capacity:50}") int queueCapacity
    ) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(corePoolSize);
        executor.setMaxPoolSize(maxPoolSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix("auto-showtime-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
