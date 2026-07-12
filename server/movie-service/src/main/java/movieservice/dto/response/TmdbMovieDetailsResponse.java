package movieservice.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class TmdbMovieDetailsResponse {
    Integer tmdbId;
    String imdbId;
    String originalTitle;
    String originalLanguage;
    Integer durationMinutes;
    String releaseDate;
    String country;
    String posterUrl;
    String overview;
    Long companyId;
    String companyName;
    List<TranslationResponse> translations;
    List<CastResponse> cast;
    List<Long> genreIds;
    Integer ageRatingId;
}
