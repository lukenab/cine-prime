package movieservice.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.LayoutPositionType;
import movieservice.enums.SeatType;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LayoutPositionRequest {

    @NotNull
    Integer rowIndex;

    @NotNull
    Integer columnIndex;

    @NotNull
    String rowLabel;

    @NotNull
    LayoutPositionType positionType;

    // Chi bat buoc khi positionType = SEAT — validate trong RoomLayoutService, khong
    // dung @NotNull o day vi AISLE/EXIT/EMPTY_SPACE phai de trong.
    Integer seatNumber;
    String seatCode;
    SeatType seatType;
    String seatGroupId;
    Boolean manualOverride;
}
