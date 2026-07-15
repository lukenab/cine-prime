package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TmdbCastPreview {
    Integer tmdbId;
    String fullName;
    String photoUrl;
    String roleType;
    String characterName;
    Integer billingOrder;
    Long localPersonId;
}
