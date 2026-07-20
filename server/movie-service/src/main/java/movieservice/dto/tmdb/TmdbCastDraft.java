package movieservice.dto.tmdb;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TmdbCastDraft {
    Integer tmdbPersonId;
    String name;
    String photoUrl;
    String roleType;
    String characterName;
    Integer billingOrder;
    String gender;
    String knownForDepartment;
}
