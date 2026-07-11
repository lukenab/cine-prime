package movieservice.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.ClusterStatus;
import movieservice.validator.ValidProvince;

import java.math.BigDecimal;

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
        regexp = "^(0[35789][0-9]{8}|02[0-9]{9})$",
        message = "Invalid Vietnam phone number. Landlines (02x): 11 digits. Mobiles (03x/05x/07x/08x/09x): 10 digits."
    )
    String phoneNumber;

    @DecimalMin(value = "-90.0", message = "Latitude must be between -90 and 90")
    @DecimalMax(value = "90.0",  message = "Latitude must be between -90 and 90")
    BigDecimal latitude;

    @DecimalMin(value = "-180.0", message = "Longitude must be between -180 and 180")
    @DecimalMax(value = "180.0",  message = "Longitude must be between -180 and 180")
    BigDecimal longitude;

    ClusterStatus status;
}
