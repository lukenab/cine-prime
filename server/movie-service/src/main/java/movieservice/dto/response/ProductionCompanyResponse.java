package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProductionCompanyResponse {
    Long companyId;
    String name;
    Integer tmdbCompanyId;
    String country;
    String logoUrl;
    String websiteUrl;
}
