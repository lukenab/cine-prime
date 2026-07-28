package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaRoomFormatResponse {
    Integer formatId;
    String formatCode;
    String formatName;
    BigDecimal surcharge;
    Boolean enabled;
    /** True for 2D/3D/IMAX/SCREENX/ATMOS/4DX — derived from supports2d/supports3d/
     *  presentationSystem on every room save; toggling those directly is rejected
     *  (ROOM_FORMAT_MANAGED_AUTOMATICALLY). False for any other catalog format, which
     *  has no wizard field to derive from and can only be set through this endpoint. */
    Boolean managedAutomatically;
}
