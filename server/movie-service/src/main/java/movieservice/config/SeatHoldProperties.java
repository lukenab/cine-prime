package movieservice.config;

import java.time.Duration;
import java.util.EnumMap;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Getter;
import lombok.Setter;
import movieservice.enums.SeatHoldChannel;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "showtime.seat-hold")
public class SeatHoldProperties {

    private int maxSeatsPerBooking = 8;
    private Map<SeatHoldChannel, Duration> ttlByChannel = defaultTtl();
    private RateLimit rateLimit = new RateLimit();

    public Duration ttlFor(SeatHoldChannel channel) {
        return ttlByChannel.getOrDefault(channel, ttlByChannel.getOrDefault(SeatHoldChannel.WEB, Duration.ofMinutes(10)));
    }

    private static Map<SeatHoldChannel, Duration> defaultTtl() {
        Map<SeatHoldChannel, Duration> values = new EnumMap<>(SeatHoldChannel.class);
        values.put(SeatHoldChannel.WEB, Duration.ofMinutes(10));
        values.put(SeatHoldChannel.MOBILE, Duration.ofMinutes(8));
        values.put(SeatHoldChannel.COUNTER, Duration.ofMinutes(3));
        return values;
    }

    @Getter
    @Setter
    public static class RateLimit {
        private Duration window = Duration.ofMinutes(1);
        private int account = 12;
        private int ip = 30;
        private int showtime = 120;
    }
}
