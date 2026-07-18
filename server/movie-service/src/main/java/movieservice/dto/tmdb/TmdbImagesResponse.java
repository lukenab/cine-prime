package movieservice.dto.tmdb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** Raw deserialization target for GET /movie/{id}/images. TMDB has no "stills" for movies
 *  (only posters/backdrops/logos - "stills" exist for TV episodes) - our own domain maps
 *  extra backdrops beyond the recommended one into our STILL image_type, see TmdbService. */
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TmdbImagesResponse {

    Integer id;
    List<TmdbImageItem> posters;
    List<TmdbImageItem> backdrops;
    List<TmdbImageItem> logos;

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TmdbImageItem {
        @JsonProperty("file_path")
        String filePath;

        Integer width;
        Integer height;

        @JsonProperty("aspect_ratio")
        Double aspectRatio;

        @JsonProperty("iso_639_1")
        String iso6391;

        @JsonProperty("vote_average")
        Double voteAverage;

        @JsonProperty("vote_count")
        Integer voteCount;
    }
}
