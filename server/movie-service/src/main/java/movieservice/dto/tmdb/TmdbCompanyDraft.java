package movieservice.dto.tmdb;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TmdbCompanyDraft {
    Integer tmdbId;
    String name;
    String country;
    String logoUrl;
}
