package movieservice.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProductionCompanyRequest {

    @NotBlank(message = "Company name is required")
    @Size(max = 255)
    String name;

    @Size(max = 100)
    String country;

    @Size(max = 500)
    String logoUrl;

    @Size(max = 500)
    String websiteUrl;

    Integer tmdbCompanyId;
}
