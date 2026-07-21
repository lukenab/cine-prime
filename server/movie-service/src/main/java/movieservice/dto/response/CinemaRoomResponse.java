package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.PresentationSystem;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaRoomResponse {
    Long cinemaRoomId;
    String cinemaRoomName;
    Integer totalSeatCapacity;
    Integer numberOfRows;
    Integer seatsPerRow;
    CinemaRoomStatus status;
    String maintenanceNote;
    String createdBy;
    Long clusterId;
    String clusterName;

    // ── Wizard fields (null for rooms created via the legacy quick-create flow) ──
    String roomCode;

    BigDecimal lengthM;
    BigDecimal widthM;
    BigDecimal clearHeightM;
    BigDecimal areaSqm; // computed = lengthM * widthM, read-only

    Integer auditoriumClassId;
    String auditoriumClassCode;
    String auditoriumClassName;

    Integer projectionTechnologyId;
    String projectionTechnologyCode;
    String projectionTechnologyName;
    PresentationSystem presentationSystem;

    Integer resolutionId;
    String resolutionCode;

    BigDecimal screenWidthM;
    BigDecimal screenHeightM;
    BigDecimal screenAspectRatio; // computed = screenWidthM / screenHeightM, read-only
    Boolean supports2d;
    Boolean supports3d;

    Integer audioFormatId;
    String audioFormatCode;

    // Lightweight pointer to the current ACTIVE (or, if none yet, latest) layout
    // version — full detail via GET /api/cinema-rooms/{roomId}/layouts/{layoutId}.
    RoomLayoutSummaryResponse activeLayout;
}
