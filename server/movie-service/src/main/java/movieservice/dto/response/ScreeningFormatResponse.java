package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ScreeningFormatResponse {
    Integer formatId;
    String formatCode;
    String formatName;
    String description;
    String status;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
