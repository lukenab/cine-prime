package movieservice.dto;

import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TrackingEvent {
    private String eventId;
    private String eventType;
    private String userId;
    private String deviceOs;
    private String clientIp;
    private long timestamp;
    private String source;
    private Map<String, Object> properties;
}