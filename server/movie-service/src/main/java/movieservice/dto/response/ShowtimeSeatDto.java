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
    private String seatCode;
    private String seatGroupId;
    private String row;
    private Integer number;
    private String type; // "STANDARD" | "VIP" | "COUPLE" | "ACCESSIBLE"
    private Integer colSpan; // so cot vat ly ghe chiem trong hang (Couple = 2)
    private Boolean aisleAfter; // co loi di ngay sau ghe nay khong (render gap tron o so do ghe)
    private String status; // "AVAILABLE" | "LOCKED" | "BOOKED"
    private BigDecimal price;
    // True when this LOCKED seat's active hold belongs to the requesting
    // account, so the client can offer "resume checkout" instead of showing
    // it as unavailable. Always false for AVAILABLE/BOOKED and for anonymous callers.
    private boolean reservedByMe;
}
