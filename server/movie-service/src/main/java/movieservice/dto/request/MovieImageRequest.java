package movieservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieImageRequest {

    @NotBlank(message = "Image URL is required")
    String imageUrl;

    // POSTER | BACKDROP | STILL | PROMOTIONAL  (default: STILL)
    String imageType;

    Integer displayOrder;

    String caption;
}
