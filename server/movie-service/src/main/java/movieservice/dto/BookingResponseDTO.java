package movieservice.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class BookingResponseDTO {
    public String bookingId;
    public int userId;
    public int movieId;
    public int scheduleId;
    public List<SeatDTO> seats; // Đây là danh sách ghế bạn cần
    public double totalPrice;
    public String status;
}
