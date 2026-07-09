package movieservice.dto.tmdb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TmdbReleaseDatesResponse {

    List<CountryRelease> results;

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CountryRelease {
        @JsonProperty("iso_3166_1")
        String countryCode;

        @JsonProperty("release_dates")
        List<ReleaseDate> releaseDates;
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ReleaseDate {
        String certification;
        /** type 3 = Theatrical release */
        Integer type;
    }
}
