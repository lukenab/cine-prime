package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.DayOfWeek;
import java.time.LocalTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ClusterOperatingHourResponse {
    DayOfWeek dayOfWeek;
    LocalTime opensAt;
    LocalTime closesAt;
    boolean closesNextDay;
    boolean closed;
}
