package bookingservice.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;

@Value
@Builder
public class BookingDetailResponse {
    String bookingId;
    String bookingCode;
    String status;
    String paymentStatus;
    String inventoryStatus;
    Long showtimeId;
    Long movieId;
    String movieName;
    Long cinemaClusterId;
    String cinemaClusterName;
    Long cinemaRoomId;
    String cinemaRoomName;
    LocalDate showDate;
    LocalTime startTime;
    List<BookingItemResponse> seats;
    List<ConcessionLineResponse> concessions;
    BigDecimal ticketSubtotal;
    BigDecimal concessionSubtotal;
    BigDecimal subtotal;
    BigDecimal serviceFee;
    BigDecimal discount;
    BigDecimal total;
    String currency;
    OffsetDateTime expiresAt;
    OffsetDateTime paidAt;
    OffsetDateTime createdAt;
    String concessionOrderId;
    String concessionPickupCode;
}
