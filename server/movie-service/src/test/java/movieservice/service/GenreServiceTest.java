package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.response.GenreResponse;
import movieservice.entity.Genre;
import movieservice.enums.GenreStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.GenreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GenreServiceTest {

    @Mock GenreRepository genreRepository;
    @Mock MovieMapper movieMapper;

    GenreService genreService;

    private static final long GENRE_ID = 1L;

    @BeforeEach
    void setUp() {
        genreService = new GenreService(genreRepository, movieMapper);
    }

    private Genre pendingGenre() {
        Genre genre = new Genre();
        genre.setGenreId(GENRE_ID);
        genre.setGenreName("TMDB Genre 27");
        genre.setGenreCode("TMDB_27");
        genre.setStatus(GenreStatus.PENDING_REVIEW);
        return genre;
    }

    @Test
    void approve_PendingReviewGenre_PromotesToActive() {
        Genre genre = pendingGenre();
        when(genreRepository.findById(GENRE_ID)).thenReturn(Optional.of(genre));
        when(genreRepository.save(any(Genre.class))).thenAnswer(inv -> inv.getArgument(0));
        when(movieMapper.toGenreResponse(any(Genre.class))).thenAnswer(inv -> {
            Genre g = inv.getArgument(0);
            return GenreResponse.builder().genreId(g.getGenreId()).genreName(g.getGenreName())
                    .genreCode(g.getGenreCode()).status(g.getStatus().name()).build();
        });

        GenreResponse response = genreService.approve(GENRE_ID);

        assertEquals("ACTIVE", response.getStatus());
        assertEquals(GenreStatus.ACTIVE, genre.getStatus());
    }

    @Test
    void approve_AlreadyActiveGenre_ThrowsAndDoesNotSave() {
        Genre genre = pendingGenre();
        genre.setStatus(GenreStatus.ACTIVE);
        when(genreRepository.findById(GENRE_ID)).thenReturn(Optional.of(genre));

        AppException ex = assertThrows(AppException.class, () -> genreService.approve(GENRE_ID));

        assertEquals(MovieErrorCode.GENRE_NOT_PENDING_REVIEW, ex.getErrorCode());
        verify(genreRepository, never()).save(any());
    }

    @Test
    void approve_GenreNotFound_ThrowsGenreNotFound() {
        when(genreRepository.findById(GENRE_ID)).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () -> genreService.approve(GENRE_ID));

        assertEquals(MovieErrorCode.GENRE_NOT_FOUND, ex.getErrorCode());
    }
}
