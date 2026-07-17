package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LayoutPositionResponse {
    Long positionId;
    Integer rowIndex;
    Integer columnIndex;
    String rowLabel;
    String positionType;
    Integer seatNumber;
    String seatCode;
    String seatType;
    String seatGroupId;
    String seatStatus;
    Boolean manualOverride;
}
