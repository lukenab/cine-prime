package movieservice.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.RoomType;

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

    @NotNull
    RoomType roomType;

    @NotNull
    @Min(10)
    Integer totalSeatCapacity;

    @NotNull
    @DecimalMin(value = "0.0", inclusive = false)
    BigDecimal defaultPrice;

    @NotNull(message = "Cluster is required — every room must belong to a cinema cluster")
    Long clusterId;
}
