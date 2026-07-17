package movieservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.ClusterStatus;
import movieservice.enums.CinemaVenueType;
import movieservice.validator.ValidProvince;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaClusterRequest {

    @NotBlank(message = "Cluster code is required")
    @Pattern(regexp = "^[A-Z0-9][A-Z0-9-]{1,19}$", message = "Cluster code must contain 2-20 uppercase letters, numbers, or hyphens")
    String clusterCode;

    @NotBlank(message = "Cluster name is required")
    @Size(min = 2, max = 100, message = "Cluster name must be between 2 and 100 characters")
    String clusterName;

    @NotNull(message = "Venue type is required")
    CinemaVenueType venueType;

    LocalDate openingDate;

    @Email(message = "Public email must be valid")
    @Size(max = 150, message = "Public email must not exceed 150 characters")
    String publicEmail;

    @NotBlank(message = "Country code is required")
    @Pattern(regexp = "^[A-Z]{2}$", message = "Country code must be an ISO 3166-1 alpha-2 code")
    String countryCode;

    @NotBlank(message = "Province is required")
    @ValidProvince
    String province;

    @NotBlank(message = "District is required")
    @Size(max = 100, message = "District must not exceed 100 characters")
    String district;

    @Size(max = 100, message = "Ward must not exceed 100 characters")
    String ward;

    @Size(max = 20, message = "Postal code must not exceed 20 characters")
    String postalCode;

    @Size(max = 150, message = "Building name must not exceed 150 characters")
    String buildingName;

    @Size(max = 50, message = "Floor location must not exceed 50 characters")
    String floorLocation;

    @NotBlank(message = "Address is required")
    @Size(min = 10, max = 255, message = "Address must be at least 10 characters")
    String address;

    @DecimalMin(value = "-90.0", message = "Latitude must be between -90 and 90")
    @DecimalMax(value = "90.0",  message = "Latitude must be between -90 and 90")
    BigDecimal latitude;

    @DecimalMin(value = "-180.0", message = "Longitude must be between -180 and 180")
    @DecimalMax(value = "180.0",  message = "Longitude must be between -180 and 180")
    BigDecimal longitude;

    @NotBlank(message = "Timezone is required")
    @Size(max = 50, message = "Timezone must not exceed 50 characters")
    String timezone;

    @NotNull(message = "Operating hours are required")
    @Size(min = 7, max = 7, message = "Operating hours must contain exactly seven days")
    List<@Valid ClusterOperatingHourRequest> operatingHours;

    ClusterStatus status;
}
