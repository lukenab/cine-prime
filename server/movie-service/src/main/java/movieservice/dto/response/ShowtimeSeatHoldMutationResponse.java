package movieservice.dto.response;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShowtimeSeatHoldMutationResponse {
    private String holdId;
    private Long showtimeId;
    private List<Long> seatIds;
    private String status;
    private String bookingId;
    private boolean replayed;
}
