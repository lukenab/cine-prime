package movieservice.dto.request;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class ShowTimeRequest {

    @NotNull(message = "Ngày chiếu không được để trống")
    @FutureOrPresent(message = "Ngày chiếu phải từ hôm nay trở đi")
    private LocalDate showDate;

    @NotNull(message = "Giờ bắt đầu không được để trống")
    private LocalTime startTime;
    private LocalTime endTime;

    @NotNull(message = "Phòng chiếu không được để trống")
    private Long cinemaRoomId;
}