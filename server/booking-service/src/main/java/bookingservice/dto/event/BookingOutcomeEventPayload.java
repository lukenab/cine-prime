package bookingservice.dto.event;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

/** Financial snapshot consumed by the analytics read model. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BookingOutcomeEventPayload {
    String accountId;
    String bookingId;
    Long clusterId;
    Long showtimeId;
    Integer ticketCount;
    BigDecimal ticketAmount;
    BigDecimal concessionAmount;
    BigDecimal discountAmount;
    BigDecimal finalAmount;
    BigDecimal refundAmount;
    String currency;
}
