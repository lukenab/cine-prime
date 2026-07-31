package bookingservice.dto.response;

import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Data
public class ConcessionOrderResponse {
    private String orderId;
    private String bookingId;
    private String paymentId;
    private Long cinemaClusterId;
    private String pickupCode;
    private String status;
    private OffsetDateTime paidAt;
    private BigDecimal total;
    private String currency;
    private List<ConcessionLineResponse> items;
}
