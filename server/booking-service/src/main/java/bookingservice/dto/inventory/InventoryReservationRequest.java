package bookingservice.dto.inventory;

import lombok.*;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryReservationRequest {
    private String holdReference;
    private String ownerAccountId;
    private List<Long> showtimeSeatIds;
}
