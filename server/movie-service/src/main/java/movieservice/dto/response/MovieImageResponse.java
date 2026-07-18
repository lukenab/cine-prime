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
    String source;
    String externalPath;
    String languageCode;
    Integer width;
    Integer height;
    java.math.BigDecimal aspectRatio;
    Boolean isDefault;
}
