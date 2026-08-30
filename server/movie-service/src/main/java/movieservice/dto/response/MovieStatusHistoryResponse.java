package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/** Read-only audit projection for a movie content lifecycle transition. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieStatusHistoryResponse {
    Long historyId;
    String fromStatus;
    String toStatus;
    String actor;
    String reason;
    LocalDateTime createdAt;
}
