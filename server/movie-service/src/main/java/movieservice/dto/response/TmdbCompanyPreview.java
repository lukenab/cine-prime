package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TmdbCompanyPreview {
    Integer tmdbId;
    String name;
    String country;
    String logoUrl;
    Long localCompanyId;
}
