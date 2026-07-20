package movieservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.PresentationSystem;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaRoomRequest {

    @NotBlank
    @Size(min = 2, max = 100)
    String cinemaRoomName;

    @NotNull(message = "Cluster is required — every room must belong to a cinema cluster")
    Long clusterId;

    // Room creation always goes through the wizard: created DRAFT with no flat Seat
    // generation, and the real layout is authored afterwards through RoomLayoutController.
    // See CinemaRoomService.createCinemaRoom().
    String roomCode;

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
