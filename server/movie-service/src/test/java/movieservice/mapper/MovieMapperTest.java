package movieservice.mapper;

import movieservice.dto.request.UpdateMovieRequest;
import movieservice.entity.Movie;
import movieservice.enums.MovieStatus;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Issue #143 - partial-update null-safety cua MovieMapper.updateMovieFromRequest().
 * Dung truc tiep MovieMapperImpl (class MapStruct sinh ra luc compile, khong can Spring context)
 * de kiem tra dung hanh vi cua @BeanMapping(nullValuePropertyMappingStrategy = IGNORE):
 * field null trong UpdateMovieRequest KHONG duoc ghi de gia tri hien co tren entity Movie.
 * Truoc khi fix, moi field null trong request se bi MapStruct set thang len entity, xoa mat
 * du lieu hien co neu client chi gui partial payload.
 */
class MovieMapperTest {

    private final MovieMapper mapper = new MovieMapperImpl();

    private Movie existingMovie() {
        return Movie.builder()
                .movieId(1L)
                .originalTitle("Original Title")
                .originalLanguage("en")
                .durationMinutes(120)
                .releaseDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 6, 1))
                .country("USA")
                .posterUrl("https://example.com/poster.jpg")
                .thumbnailUrl("https://example.com/thumb.jpg")
                .trailerUrl("https://example.com/trailer.mp4")
                .synopsis("Original synopsis")
                .status(MovieStatus.NOW_SHOWING)
                .build();
    }

    @Test
    void partialRequestOnlyUpdatesFieldsThatAreSent() {
        Movie movie = existingMovie();

        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .trailerUrl("https://example.com/new-trailer.mp4")
                // Moi field khac deu null (khong gui trong payload) - phai giu nguyen.
                .build();

        mapper.updateMovieFromRequest(request, movie);

        assertEquals("https://example.com/new-trailer.mp4", movie.getTrailerUrl(),
                "trailerUrl la field duy nhat duoc gui - phai duoc cap nhat");
        assertEquals("Original Title", movie.getOriginalTitle(),
                "originalTitle khong duoc gui - phai giu nguyen, KHONG bi set null");
        assertEquals("en", movie.getOriginalLanguage(),
                "originalLanguage khong duoc gui - phai giu nguyen");
        assertEquals(120, movie.getDurationMinutes(),
                "durationMinutes khong duoc gui - phai giu nguyen");
        assertEquals(LocalDate.of(2026, 1, 1), movie.getReleaseDate(),
                "releaseDate khong duoc gui - phai giu nguyen");
        assertEquals(LocalDate.of(2026, 6, 1), movie.getEndDate(),
                "endDate khong duoc gui - phai giu nguyen");
        assertEquals("USA", movie.getCountry(),
                "country khong duoc gui - phai giu nguyen");
        assertEquals("https://example.com/poster.jpg", movie.getPosterUrl(),
                "posterUrl khong duoc gui - phai giu nguyen");
        assertEquals("https://example.com/thumb.jpg", movie.getThumbnailUrl(),
                "thumbnailUrl khong duoc gui - phai giu nguyen");
        assertEquals("Original synopsis", movie.getSynopsis(),
                "synopsis khong duoc gui - phai giu nguyen");
    }

    @Test
    void fullyEmptyRequestChangesNothing() {
        Movie movie = existingMovie();
        UpdateMovieRequest request = UpdateMovieRequest.builder().build();

        mapper.updateMovieFromRequest(request, movie);

        Movie expected = existingMovie();
        assertEquals(expected.getOriginalTitle(), movie.getOriginalTitle());
        assertEquals(expected.getOriginalLanguage(), movie.getOriginalLanguage());
        assertEquals(expected.getDurationMinutes(), movie.getDurationMinutes());
        assertEquals(expected.getReleaseDate(), movie.getReleaseDate());
        assertEquals(expected.getEndDate(), movie.getEndDate());
        assertEquals(expected.getCountry(), movie.getCountry());
        assertEquals(expected.getPosterUrl(), movie.getPosterUrl());
        assertEquals(expected.getThumbnailUrl(), movie.getThumbnailUrl());
        assertEquals(expected.getTrailerUrl(), movie.getTrailerUrl());
        assertEquals(expected.getSynopsis(), movie.getSynopsis());
    }

    @Test
    void movieIdAndStatusAreNeverTouchedByUpdateMapping() {
        Movie movie = existingMovie();

        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .originalTitle("Changed Title")
                .build();

        mapper.updateMovieFromRequest(request, movie);

        assertEquals(1L, movie.getMovieId(),
                "movieId phai duoc @Mapping(ignore = true), khong duoc mapper dong vao");
        assertEquals(MovieStatus.NOW_SHOWING, movie.getStatus(),
                "status phai duoc @Mapping(ignore = true), khong duoc mapper dong vao - "
                        + "chuyen trang thai chi qua cac endpoint status transition rieng");
    }
}
