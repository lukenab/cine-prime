package bookingservice.dto.inventory;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryConfirmRequest {
    private String holdToken;
    private String bookingId;
}
