package bookingservice.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

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
public class BookingDetailResponse {
    String bookingId;
    String accountId;
    String memberId;
    String movieName;
    LocalDate showDate;       // Trả ra dạng yyyy-MM-dd
    LocalTime startTime;      // Trả ra dạng HH:mm:ss
    String cinemaRoomName;
    Integer totalSeats;
    BigDecimal finalAmount;   // map vào trường totalPrice/finalAmount của bạn
    String bookingType;       // ONLINE / OFFLINE
    String status;            // PENDING, CONFIRMED, CANCELLED
    LocalDateTime createdAt;
}
