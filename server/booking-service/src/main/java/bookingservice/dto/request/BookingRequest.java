package bookingservice.dto.request;

import java.util.List;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Data
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingRequest {
    @Min(value = 1, message = "SHOWTIME_ID_INVALID")
    Long showtimeId;

    @Size(max = 8, message = "MAX_SEATS_EXCEEDED") 
    List<Long> seatIds;

    @Min(value = 0, message = "POINTS_CANNOT_BE_NEGATIVE")
    Integer pointsUsed = 0;

    /**
     * Ma khuyen mai do UI nhap. Booking Service khong nhan movieId, subtotal
     * hay discount tu client; cac gia tri do duoc lay tu Movie/Promotion Service.
     */
    @Size(max = 100, message = "PROMOTION_CODE_TOO_LONG")
    String promotionCode;

    /** Alternate create path: materialize an unexpired server-side quote. */
    @Size(max = 36, message = "QUOTE_ID_INVALID")
    String quoteId;

    /** Keeps existing direct-booking callers source-compatible. */
    public BookingRequest(Long showtimeId, List<Long> seatIds, Integer pointsUsed, String promotionCode) {
        this.showtimeId = showtimeId;
        this.seatIds = seatIds;
        this.pointsUsed = pointsUsed;
        this.promotionCode = promotionCode;
    }
}
