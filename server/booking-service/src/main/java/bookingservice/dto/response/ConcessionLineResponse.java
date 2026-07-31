package bookingservice.dto.response;

import lombok.*;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConcessionLineResponse {
    String itemCode;
    String itemName;
    String options;
    Integer quantity;
    BigDecimal unitPrice;
    BigDecimal discountAmount;
    BigDecimal finalAmount;
}
