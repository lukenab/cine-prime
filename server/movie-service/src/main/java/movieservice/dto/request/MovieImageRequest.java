package movieservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.MovieImageType;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieImageRequest {

    @NotBlank(message = "Image URL is required")
    String imageUrl;

    // POSTER | BACKDROP | STILL | PROMOTIONAL | LOGO (default: STILL)
    MovieImageType imageType;

    Integer displayOrder;

    String caption;
}
