package movieservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UpdateMovieRequest {

    @Size(max = 500)
    String originalTitle;

    @Size(min = 2, max = 2)
    String originalLanguage;

    @Min(1)
    Integer durationMinutes;

    LocalDate releaseDate;

    @Size(max = 100)
    String country;

    Integer ageRatingId;
    List<Long> companyIds;
    List<Long> genreIds;
    List<Integer> formatIds;

    @Size(max = 500)
    String posterUrl;

    @Size(max = 500)
    String thumbnailUrl;

    @Size(max = 500)
    String trailerUrl;
    String synopsis;

    /** Original-language tagline - mirrors synopsis. Localized ones live on each translation. */
    @Size(max = 500)
    String tagline;

    @Valid
    List<TranslationRequest> translations;
    @Valid
    List<CastRequest> cast;
}
