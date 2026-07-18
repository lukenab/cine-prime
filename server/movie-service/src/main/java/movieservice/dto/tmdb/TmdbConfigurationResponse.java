package movieservice.dto.tmdb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** Raw deserialization target for GET /configuration. Fetched once and cached (see
 *  TmdbService.getImageConfig()) - this rarely if ever changes. */
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TmdbConfigurationResponse {

    Images images;

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Images {
        @JsonProperty("secure_base_url")
        String secureBaseUrl;

        @JsonProperty("poster_sizes")
        List<String> posterSizes;

        @JsonProperty("backdrop_sizes")
        List<String> backdropSizes;
    }
}
