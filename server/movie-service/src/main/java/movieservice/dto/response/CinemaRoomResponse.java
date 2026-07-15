package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.RoomType;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaRoomResponse {
    Long cinemaRoomId;
    String cinemaRoomName;
    RoomType roomType;
    Integer totalSeatCapacity;
    Integer numberOfRows;
    Integer seatsPerRow;
    Integer standardRowCount;
    Integer vipRowCount;
    Integer coupleRowCount;
    CinemaRoomStatus status;
    String maintenanceNote;
    Long clusterId;
    String clusterName;
}
