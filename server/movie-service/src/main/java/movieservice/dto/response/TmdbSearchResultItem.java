package movieservice.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TmdbSearchResultItem {
    Integer tmdbId;
    String title;
    String originalTitle;
    String releaseDate;
    String posterUrl;
    String overview;
}
