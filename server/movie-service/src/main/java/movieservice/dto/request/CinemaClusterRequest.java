package movieservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.ClusterStatus;
import movieservice.validator.ValidProvince;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaClusterRequest {

    @NotBlank(message = "Cluster name is required")
    @Size(min = 2, max = 100, message = "Cluster name must be between 2 and 100 characters")
    String clusterName;

    @NotBlank(message = "Province is required")
    @ValidProvince
    String province;

    @NotBlank(message = "Address is required")
    @Size(min = 10, max = 255, message = "Address must be at least 10 characters")
    String address;

    @Pattern(
        regexp = "^(0[35789][0-9]{8})$",
        message = "Invalid Vietnam phone number. Must be 10 digits starting with 03x, 05x, 07x, 08x, or 09x"
    )
    String phoneNumber;

    ClusterStatus status;
}
