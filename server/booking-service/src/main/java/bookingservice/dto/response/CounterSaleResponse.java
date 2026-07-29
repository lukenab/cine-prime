package bookingservice.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Value
@Builder
public class CounterSaleResponse {
    String bookingId;
    String bookingCode;
    String status;
    String paymentStatus;
    String paymentReference;
    String receiptReference;
    String paymentMethod;
    BigDecimal total;
    String currency;
    List<String> seatCodes;
    OffsetDateTime paidAt;
    boolean replayed;
}
