package movieservice.dto.tmdb;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TranslationDraft {
    String languageCode;
    String title;
    String synopsis;
    String tagline;
}
