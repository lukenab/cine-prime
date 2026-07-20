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
public class ScreeningFormatRequest {

    @NotBlank(message = "Format code is required")
    @Size(max = 20)
    String formatCode;

    @NotBlank(message = "Format name is required")
    @Size(max = 100)
    String formatName;

    @Size(max = 255)
    String description;

    @NotNull(message = "Surcharge is required")
    @DecimalMin("0.0")
    BigDecimal surcharge;

    @Size(max = 20)
    String status;
}
