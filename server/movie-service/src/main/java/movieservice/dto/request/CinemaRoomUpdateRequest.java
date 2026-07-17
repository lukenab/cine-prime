package movieservice.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import movieservice.enums.PresentationSystem;

// Step 1/2 wizard fields — updatable only while the room is DRAFT (see
// CinemaRoomService.updateRoom). Everything is optional/nullable: the wizard
// autosaves partial progress ("Lưu bản nháp"), so PUT here must accept an
// incomplete room. Completeness is only enforced at layout submit time.
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaRoomUpdateRequest {
    String roomCode;
    String cinemaRoomName;
    Integer auditoriumClassId;

    BigDecimal lengthM;
    BigDecimal widthM;
    BigDecimal clearHeightM;

    Integer projectionTechnologyId;
    PresentationSystem presentationSystem;
    Integer resolutionId;
    BigDecimal screenWidthM;
    BigDecimal screenHeightM;
    Boolean supports2d;
    Boolean supports3d;
    Integer audioFormatId;
}
