package movieservice.dto.request;

import jakarta.persistence.Column;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CinemaRoomRequest {
    @NotBlank(message = "Cinema room name must not be blank")
    @Size(min = 2, max = 100, message = "Cinema room name must be between 2 and 100 characters")
    private String cinemaRoomName;

    @NotNull(message = "Seat quantity must not be null")
    @Min(value = 10, message = "Seat quantity must be at least 10 seats")
    private Integer seatQuantity;
}
