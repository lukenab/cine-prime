package bookingservice.dto.response;

import java.math.BigDecimal;

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
public class SeatAvailabilityResponse {
    Long showtimeSeatId; 
    BigDecimal price;    
    String seatCode;     
    String seatType;    
    String status;       
    Long seatId;        
    Long showtimeId;     
}
