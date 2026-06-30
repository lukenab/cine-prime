package bookingservice.dto.response;

import java.math.BigDecimal;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingItemResponse {
    Long seatId;        // Lưu ID của ghế (ví dụ: 101, 102)
    String seatLabel;   // Nhãn hiển thị của ghế (ví dụ: "A1", "A2")
    BigDecimal price;   // Giá tiền áp dụng riêng cho ghế này
}
