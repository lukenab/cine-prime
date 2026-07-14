package movieservice.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
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

    // totalSeatCapacity khong con nhan tu client — server tinh = numberOfRows * seatsPerRow
    // (xem CinemaRoomService.createCinemaRoom). RoomType chi con vai tro cung cap gia tri
    // mac dinh goi y + gioi han maxSeats, khong ep cung seatsPerRow theo loai phong nua.
    @NotNull
    @Min(1)
    Integer numberOfRows;

    @NotNull
    @Min(1)
    Integer seatsPerRow;

    // Seat zones are configured per room. The backend validates that these three
    // values add up exactly to numberOfRows before generating the seat map.
    @NotNull
    @Min(0)
    @Max(50)
    Integer standardRowCount;

    @NotNull
    @Min(0)
    @Max(50)
    Integer vipRowCount;

    @NotNull
    @Min(0)
    @Max(50)
    Integer coupleRowCount;

    @NotNull
    @DecimalMin(value = "0.0", inclusive = false)
    BigDecimal defaultPrice;

    @NotNull(message = "Cluster is required — every room must belong to a cinema cluster")
    Long clusterId;
}
