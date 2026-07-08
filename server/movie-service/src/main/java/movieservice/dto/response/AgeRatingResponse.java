package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AgeRatingResponse {
    Integer ratingId;
    String ratingCode;
    Integer minAge;
    String description;
}
