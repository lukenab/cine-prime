package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaClusterResponse {
    Long clusterId;
    String clusterName;
    String province;
    String address;
    String phoneNumber;
    String status;
    Integer totalRooms;
    Integer totalSeats;
}
