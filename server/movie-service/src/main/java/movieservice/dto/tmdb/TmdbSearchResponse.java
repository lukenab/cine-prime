package movieservice.dto.tmdb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TmdbSearchResponse {

    @JsonProperty("results")
    List<MovieItem> results;

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class MovieItem {
        Integer id;
        String title;

        @JsonProperty("original_title")
        String originalTitle;

        @JsonProperty("release_date")
        String releaseDate;

        @JsonProperty("poster_path")
        String posterPath;

        String overview;
    }
}
