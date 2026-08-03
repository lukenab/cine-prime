package bookingservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class TimeConfig {

    @Bean
    Clock bookingClock() {
        return Clock.systemUTC();
    }
}
