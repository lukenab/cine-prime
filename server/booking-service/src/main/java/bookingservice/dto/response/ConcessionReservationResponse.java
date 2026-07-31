package bookingservice.dto.response;

import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Data
public class ConcessionReservationResponse {
    private String reservationId;
    private String bookingId;
    private Long cinemaClusterId;
    private String status;
    private OffsetDateTime expiresAt;
    private BigDecimal total;
    private String currency;
    private boolean replayed;
    private List<ConcessionLineResponse> items;
}
