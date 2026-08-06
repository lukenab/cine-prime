package movieservice.util;

import movieservice.entity.Movie;
import movieservice.entity.MovieTranslation;
import movieservice.entity.MovieTranslationId;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MovieTitleResolverTest {

    @Test
    void prefersVietnameseThenEnglishThenOriginalTitle() {
        Movie movie = Movie.builder()
                .movieId(10L)
                .originalLanguage("ko")
                .originalTitle("신사: 악귀의 속삭임")
                .translations(List.of(
                        translation(10L, "en", "The Cursed Whisper"),
                        translation(10L, "vi", "Lời Thì Thầm Của Ác Quỷ")))
                .build();

        assertEquals("Lời Thì Thầm Của Ác Quỷ", MovieTitleResolver.preferredVietnameseTitle(movie));
        assertTrue(MovieTitleResolver.hasVietnameseDisplayTitle(movie));

        movie.setTranslations(List.of(translation(10L, "en", "The Cursed Whisper")));
        assertEquals("The Cursed Whisper", MovieTitleResolver.preferredVietnameseTitle(movie));
        assertFalse(MovieTitleResolver.hasVietnameseDisplayTitle(movie));

        movie.setTranslations(List.of());
        assertEquals("신사: 악귀의 속삭임", MovieTitleResolver.preferredVietnameseTitle(movie));
    }

    @Test
    void acceptsTheCanonicalTitleForVietnameseOriginals() {
        Movie movie = Movie.builder()
                .originalLanguage("vi")
                .originalTitle("Mai")
                .translations(List.of())
                .build();

        assertEquals("Mai", MovieTitleResolver.preferredVietnameseTitle(movie));
        assertTrue(MovieTitleResolver.hasVietnameseDisplayTitle(movie));
    }

    private static MovieTranslation translation(Long movieId, String language, String title) {
        return MovieTranslation.builder()
                .id(new MovieTranslationId(movieId, language))
                .title(title)
                .build();
    }
}
