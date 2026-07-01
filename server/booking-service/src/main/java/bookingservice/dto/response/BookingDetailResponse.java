package bookingservice.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

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
    LocalDate showDate;       
    LocalTime startTime;      
    String cinemaRoomName;
    Integer totalSeats;
    BigDecimal finalAmount;   
    String bookingType;       
    String status;            
    LocalDateTime createdAt;
    List<BookingItemResponse> items;
}
