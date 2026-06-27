package bookingservice.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
@Data
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
public class BookingResponse {
    private String bookingId;
    private String status;
    private LocalDateTime updatedAt;
}
