package movieservice.dto.request;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
import movieservice.enums.RoomType;

@Data
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaRoomRequest {
    @NotBlank(message = "Cinema room name must not be blank")
    @Size(min = 2, max = 100, message = "Cinema room name must be between 2 and 100 characters")
    String cinemaRoomName;

    @NotNull(message = "Room type must not be null")
    RoomType roomType;

    @NotNull(message = "Seat quantity must not be null")
    @Min(value = 10, message = "Seat quantity must be at least 10 seats")
    Integer seatQuantity;

    @NotNull(message = "Default seat price must not be null")
    @DecimalMin(value = "0.0", inclusive = false, message = "Default seat price must be greater than 0")
    BigDecimal defaultPrice;
}
