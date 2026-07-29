package paymentservice.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Data
public class BookingSnapshot {
    private String bookingId;
    private String status;
    private String paymentStatus;
    private BigDecimal total;
    private String currency;
    private OffsetDateTime expiresAt;
}
