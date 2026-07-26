package bookingservice.dto.inventory;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryReleaseRequest {
    private String holdToken;
    private String holdReference;
    private String reason;
}
