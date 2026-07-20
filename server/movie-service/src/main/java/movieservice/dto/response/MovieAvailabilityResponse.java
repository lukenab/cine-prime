package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieAvailabilityResponse {

    Long availabilityId;
    Long movieId;
    String movieTitle;
    Long clusterId;
    String clusterName;

    String status;

    LocalDateTime salesStartAt;
    LocalDate showingStartDate;
    LocalDate showingEndDate;
    String suspensionReason;

    Long version;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
    String createdBy;
    String updatedBy;
}
