package movieservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.ClusterStatus;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaClusterRequest {

    @NotBlank(message = "Cluster name is required")
    @Size(max = 100)
    String clusterName;

    @NotBlank(message = "Province is required")
    @Size(max = 100)
    String province;

    @NotBlank(message = "Address is required")
    @Size(max = 255)
    String address;

    @Size(max = 20)
    String phoneNumber;

    ClusterStatus status;
}
