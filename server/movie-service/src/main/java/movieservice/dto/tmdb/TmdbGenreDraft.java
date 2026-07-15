package movieservice.dto.tmdb;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TmdbGenreDraft {
    Integer tmdbGenreId;
    String name;
}
