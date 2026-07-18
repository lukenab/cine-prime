package movieservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import movieservice.enums.MovieImageType;

import java.util.List;

/**
 * Selective TMDB image import. Admin picks specific candidates (returned by
 * GET /api/movies/tmdb/{tmdbId}/details as .media.posters/.backdrops/.stills) rather than
 * the backend blindly importing everything TMDB has - selections is required, there is no
 * "import all" implicit default (the recommendation only pre-selects candidates on the
 * frontend; the request must still name exactly what to persist).
 */
@Getter
@Setter
public class TmdbImageImportRequest {

    @NotNull
    Integer tmdbId;

    @NotEmpty(message = "At least one image selection is required")
    List<@Valid Selection> selections;

    @Getter
    @Setter
    public static class Selection {
        @NotBlank
        String filePath;

        @NotNull
        MovieImageType imageType;

        String languageCode;

        @Min(1)
        Integer displayOrder;
    }
}
