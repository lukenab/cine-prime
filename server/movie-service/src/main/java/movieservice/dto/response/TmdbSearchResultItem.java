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
    /** true neu phim nay da ton tai trong DB (theo tmdbId) - dung de disable/badge o UI browse list */
    boolean alreadyImported;
}
