package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RoomLayoutResponse {
    Long roomLayoutId;
    Long cinemaRoomId;
    Integer version;
    String status;

    Integer numberOfRows;
    Integer maxPositionsPerRow;
    String firstRowLabel;
    String numberingDirection;
    String numberingPolicy;
    String generatorTemplateCode;
    Integer generatorTemplateVersion;
    String generationConfig;

    // Read-only, backend-computed — xem RoomLayoutService.recomputeCapacity()
    Integer personCapacity;
    Integer sellableUnitCount;

    LocalDateTime submittedAt;
    String submittedBy;
    LocalDateTime approvedAt;
    String approvedBy;
    String rejectionReason;

    List<LayoutPositionResponse> positions;

    LocalDateTime createdAt;
    String createdBy;
    LocalDateTime updatedAt;
    String updatedBy;
}
