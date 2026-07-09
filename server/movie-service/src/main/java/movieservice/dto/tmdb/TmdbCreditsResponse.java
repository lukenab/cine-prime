package movieservice.dto.tmdb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TmdbCreditsResponse {

    List<CastMember> cast;
    List<CrewMember> crew;

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CastMember {
        Integer id;
        String name;
        String character;

        @JsonProperty("order")
        Integer order;

        @JsonProperty("profile_path")
        String profilePath;
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CrewMember {
        Integer id;
        String name;
        String job;
        String department;

        @JsonProperty("profile_path")
        String profilePath;
    }
}
