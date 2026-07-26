package bookingservice.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;


@Data
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class CreateBookingResponse {
    String bookingId;
    String holdId;
    Long showtimeId;
    String status;
    BigDecimal totalPrice;
    List<BookingItemResponse> items; 
    LocalDateTime lockedUntil;       
}
