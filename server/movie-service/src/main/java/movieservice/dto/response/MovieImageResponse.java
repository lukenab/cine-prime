package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieImageResponse {
    Long imageId;
    String imageUrl;
    String imageType;
    Integer displayOrder;
    String caption;
}
