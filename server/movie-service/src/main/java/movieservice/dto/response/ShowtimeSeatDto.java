package movieservice.dto.response;

import lombok.*;
import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShowtimeSeatDto {
    private Long seatId; // Maps to ShowtimeSeat.showtimeSeatId
    private String row;
    private Integer number;
    private String type; // "STANDARD" | "VIP"
    private String status; // "AVAILABLE" | "LOCKED" | "BOOKED"
    private BigDecimal price;
}
