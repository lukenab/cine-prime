package movieservice.dto.tmdb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TmdbGenreListResponse {

    List<TmdbGenreEntry> genres;

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TmdbGenreEntry {
        Integer id;
        String name;
    }
}
