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
    CinemaRoomStatus status;
    String maintenanceNote;
}
