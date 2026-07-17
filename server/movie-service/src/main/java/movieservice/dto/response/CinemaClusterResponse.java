package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaClusterResponse {
    Long clusterId;
    String clusterCode;
    String clusterName;
    String venueType;
    LocalDate openingDate;
    String publicEmail;
    String countryCode;
    String province;
    String district;
    String ward;
    String postalCode;
    String buildingName;
    String floorLocation;
    String address;
    String phoneNumber;
    BigDecimal latitude;
    BigDecimal longitude;
    String timezone;
    List<ClusterOperatingHourResponse> operatingHours;
    String status;
    String rejectionNote;
    Integer totalRooms;
    Integer totalSeats;
    String createdBy;
    String updatedBy;
}
