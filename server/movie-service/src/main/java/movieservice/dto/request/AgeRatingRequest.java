package movieservice.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AgeRatingRequest {

    @NotBlank(message = "Rating code is required")
    @Size(max = 5)
    String ratingCode;

    @NotNull(message = "Minimum age is required")
    @Min(0) @Max(21)
    Integer minAge;

    @NotBlank(message = "Description is required")
    @Size(max = 255)
    String description;
}
