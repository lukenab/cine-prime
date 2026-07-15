package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.MovieImageType;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieImageResponse {
    Long imageId;
    String imageUrl;
    MovieImageType imageType;
    Integer displayOrder;
    String caption;
}
