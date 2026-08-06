package movieservice.util;

import movieservice.entity.Movie;
import movieservice.entity.MovieTranslation;

import java.util.List;

/**
 * Resolves the customer-facing title for CinePrime's Vietnamese market.
 * Localised metadata is preferred without overwriting the canonical title
 * supplied by the distributor/TMDB.
 */
public final class MovieTitleResolver {

    private MovieTitleResolver() {
    }

    public static String preferredVietnameseTitle(Movie movie) {
        if (movie == null) return null;

        String vietnamese = translatedTitle(movie.getTranslations(), "vi");
        if (hasText(vietnamese)) return vietnamese;

        // A Vietnamese original does not need a duplicate translation row.
        if ("vi".equalsIgnoreCase(movie.getOriginalLanguage()) && hasText(movie.getOriginalTitle())) {
            return movie.getOriginalTitle();
        }

        String english = translatedTitle(movie.getTranslations(), "en");
        return hasText(english) ? english : movie.getOriginalTitle();
    }

    public static boolean hasVietnameseDisplayTitle(Movie movie) {
        if (movie == null) return false;
        if ("vi".equalsIgnoreCase(movie.getOriginalLanguage()) && hasText(movie.getOriginalTitle())) {
            return true;
        }
        return hasText(translatedTitle(movie.getTranslations(), "vi"));
    }

    private static String translatedTitle(List<MovieTranslation> translations, String languageCode) {
        if (translations == null) return null;
        return translations.stream()
                .filter(translation -> translation != null
                        && translation.getId() != null
                        && languageCode.equalsIgnoreCase(translation.getId().getLanguageCode()))
                .map(MovieTranslation::getTitle)
                .filter(MovieTitleResolver::hasText)
                .findFirst()
                .orElse(null);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
