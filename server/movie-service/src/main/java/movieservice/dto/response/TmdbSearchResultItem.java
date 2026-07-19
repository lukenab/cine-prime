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

    /** `[Frontend] Show TMDB import warnings/mappings/media preview`: local movie ID when
     *  alreadyImported is true, so the browse list can offer a real View/Sync action instead of
     *  just disabling the item with no explanation. Null when not yet imported. */
    Long localMovieId;
}
