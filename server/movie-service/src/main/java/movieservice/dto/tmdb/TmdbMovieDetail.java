package movieservice.dto.tmdb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TmdbMovieDetail {

    Integer id;
    String title;

    @JsonProperty("original_title")
    String originalTitle;

    @JsonProperty("original_language")
    String originalLanguage;

    Integer runtime;

    @JsonProperty("release_date")
    String releaseDate;

    @JsonProperty("poster_path")
    String posterPath;

    @JsonProperty("imdb_id")
    String imdbId;

    String overview;
    String tagline;

    @JsonProperty("production_countries")
    List<TmdbCountry> productionCountries;

    @JsonProperty("production_companies")
    List<TmdbCompany> productionCompanies;

    List<TmdbGenre> genres;

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TmdbGenre {
        Integer id;
        String name;
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TmdbCountry {
        @JsonProperty("iso_3166_1")
        String code;

        String name;
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TmdbCompany {
        Integer id;
        String name;

        @JsonProperty("origin_country")
        String originCountry;

        @JsonProperty("logo_path")
        String logoPath;
    }
}
