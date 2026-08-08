package analyticsservice.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.ZoneId;

@Configuration
public class AnalyticsTimeConfig {
    @Bean
    ZoneId businessZone(@Value("${analytics.business-time-zone:Asia/Ho_Chi_Minh}") String zone) {
        return ZoneId.of(zone);
    }
}
