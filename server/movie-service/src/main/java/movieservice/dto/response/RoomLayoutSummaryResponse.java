package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RoomLayoutSummaryResponse {
    Long roomLayoutId;
    Integer version;
    String status;
    Integer personCapacity;
    Integer sellableUnitCount;
    LocalDateTime submittedAt;
    LocalDateTime approvedAt;
}
