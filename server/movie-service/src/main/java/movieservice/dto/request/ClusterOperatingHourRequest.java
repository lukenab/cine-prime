package movieservice.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.DayOfWeek;
import java.time.LocalTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ClusterOperatingHourRequest {

    @NotNull(message = "Operating day is required")
    DayOfWeek dayOfWeek;

    LocalTime opensAt;
    LocalTime closesAt;
    boolean closesNextDay;
    boolean closed;

    @AssertTrue(message = "Open days require valid opening and closing times; closed days must not contain times")
    public boolean isScheduleValid() {
        if (closed) return opensAt == null && closesAt == null && !closesNextDay;
        if (opensAt == null || closesAt == null || opensAt.equals(closesAt)) return false;
        return closesNextDay || closesAt.isAfter(opensAt);
    }
}
