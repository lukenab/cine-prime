package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.MovieImageRequest;
import movieservice.dto.request.TmdbImageImportRequest;
import movieservice.dto.response.MovieImageResponse;
import movieservice.dto.response.TmdbImageImportResponse;
import movieservice.dto.tmdb.TmdbConfigurationResponse;
import movieservice.dto.tmdb.TmdbImagesResponse;
import movieservice.entity.Movie;
import movieservice.entity.MovieImage;
import movieservice.enums.MovieImageType;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.MovieImageRepository;
import movieservice.repository.MovieRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** TMDB-FIX-05: selective import limits, dedup, and validation. */
@ExtendWith(MockitoExtension.class)
class MovieImageServiceTest {

    @Mock MovieRepository movieRepository;
    @Mock MovieImageRepository movieImageRepository;
    @Mock TmdbService tmdbService;
    @Mock MovieMapper movieMapper;

    MovieImageService movieImageService;

    private static final long MOVIE_ID = 1L;
    private static final int TMDB_ID = 693134;

    @BeforeEach
    void setUp() {
        movieImageService = new MovieImageService(movieRepository, movieImageRepository, tmdbService, movieMapper);
        Movie movie = new Movie();
        movie.setMovieId(MOVIE_ID);
        lenient().when(movieRepository.findById(MOVIE_ID)).thenReturn(Optional.of(movie));
        lenient().when(tmdbService.getMaxStills()).thenReturn(10);
        lenient().when(tmdbService.getImageConfig()).thenReturn(new TmdbConfigurationResponse());
        lenient().when(tmdbService.resolveImageUrl(any(), any(), any())).thenAnswer(inv ->
                "https://image.tmdb.org/t/p/w780" + inv.getArgument(1));
    }

    private TmdbImageImportRequest.Selection selection(String path, MovieImageType type) {
        TmdbImageImportRequest.Selection s = new TmdbImageImportRequest.Selection();
        s.setFilePath(path);
        s.setImageType(type);
        return s;
    }

    private TmdbImageImportRequest request(List<TmdbImageImportRequest.Selection> selections) {
        TmdbImageImportRequest req = new TmdbImageImportRequest();
        req.setTmdbId(TMDB_ID);
        req.setSelections(selections);
        return req;
    }

    private TmdbImagesResponse.TmdbImageItem item(String path) {
        TmdbImagesResponse.TmdbImageItem i = new TmdbImagesResponse.TmdbImageItem();
        i.setFilePath(path);
        i.setWidth(2000);
        i.setHeight(3000);
        i.setAspectRatio(2.0 / 3.0);
        i.setIso6391("en");
        return i;
    }

    private void stubTmdbImages(String... posterPaths) {
        TmdbImagesResponse images = new TmdbImagesResponse();
        List<TmdbImagesResponse.TmdbImageItem> items = new ArrayList<>();
        for (String p : posterPaths) items.add(item(p));
        images.setPosters(items);
        images.setBackdrops(List.of());
        when(tmdbService.fetchImages(TMDB_ID)).thenReturn(images);
    }

    @Test
    void rejectsMoreThanOnePosterPerImportRequest() {
        TmdbImageImportRequest req = request(List.of(
                selection("/a.jpg", MovieImageType.POSTER),
                selection("/b.jpg", MovieImageType.POSTER)));

        AppException ex = assertThrows(AppException.class, () -> movieImageService.importFromTmdb(MOVIE_ID, req));

        assertEquals(MovieErrorCode.MOVIE_IMAGE_TYPE_LIMIT_EXCEEDED, ex.getErrorCode());
        verify(movieImageRepository, never()).saveAll(any());
    }

    @Test
    void rejectsMoreThanOneBackdropPerImportRequest() {
        TmdbImageImportRequest req = request(List.of(
                selection("/a.jpg", MovieImageType.BACKDROP),
                selection("/b.jpg", MovieImageType.BACKDROP)));

        AppException ex = assertThrows(AppException.class, () -> movieImageService.importFromTmdb(MOVIE_ID, req));

        assertEquals(MovieErrorCode.MOVIE_IMAGE_TYPE_LIMIT_EXCEEDED, ex.getErrorCode());
    }

    @Test
    void rejectsStillsBeyondConfiguredMaximum() {
        when(tmdbService.getMaxStills()).thenReturn(2);
        TmdbImageImportRequest req = request(List.of(
                selection("/a.jpg", MovieImageType.STILL),
                selection("/b.jpg", MovieImageType.STILL),
                selection("/c.jpg", MovieImageType.STILL)));

        AppException ex = assertThrows(AppException.class, () -> movieImageService.importFromTmdb(MOVIE_ID, req));

        assertEquals(MovieErrorCode.MOVIE_IMAGE_TYPE_LIMIT_EXCEEDED, ex.getErrorCode());
    }

    @Test
    void rejectsSelectionNoLongerPresentInTmdbResponse() {
        stubTmdbImages("/exists.jpg");
        TmdbImageImportRequest req = request(List.of(selection("/gone.jpg", MovieImageType.POSTER)));

        AppException ex = assertThrows(AppException.class, () -> movieImageService.importFromTmdb(MOVIE_ID, req));

        assertEquals(MovieErrorCode.TMDB_IMAGE_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void skipsAlreadyImportedAssetInsteadOfCreatingADuplicate() {
        stubTmdbImages("/already-imported.jpg");
        when(movieImageRepository.findExistingSourcePathKeys(MOVIE_ID))
                .thenReturn(Set.of("TMDB:/already-imported.jpg"));
        when(movieImageRepository.saveAll(any())).thenReturn(List.of());
        when(movieMapper.toMovieImageResponseList(any())).thenReturn(List.of());

        TmdbImageImportRequest req = request(List.of(selection("/already-imported.jpg", MovieImageType.POSTER)));
        TmdbImageImportResponse response = movieImageService.importFromTmdb(MOVIE_ID, req);

        assertEquals(0, response.getImportedCount());
        assertEquals(1, response.getSkippedDuplicateCount());
        assertEquals(List.of("DUPLICATE_IMAGES_SKIPPED:1"), response.getWarnings());

        ArgumentCaptor<List<MovieImage>> captor = ArgumentCaptor.forClass(List.class);
        verify(movieImageRepository).saveAll(captor.capture());
        assertEquals(0, captor.getValue().size(), "Duplicate must never reach saveAll()");
    }

    @Test
    void importsNewSelectionsWithMetadataFromTmdb() {
        stubTmdbImages("/new-poster.jpg");
        when(movieImageRepository.findExistingSourcePathKeys(MOVIE_ID)).thenReturn(Set.of());
        when(movieImageRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        when(movieMapper.toMovieImageResponseList(any())).thenReturn(
                List.of(MovieImageResponse.builder().imageId(1L).build()));

        TmdbImageImportRequest req = request(List.of(selection("/new-poster.jpg", MovieImageType.POSTER)));
        TmdbImageImportResponse response = movieImageService.importFromTmdb(MOVIE_ID, req);

        assertEquals(1, response.getImportedCount());
        assertEquals(0, response.getSkippedDuplicateCount());

        ArgumentCaptor<List<MovieImage>> captor = ArgumentCaptor.forClass(List.class);
        verify(movieImageRepository).saveAll(captor.capture());
        MovieImage saved = captor.getValue().get(0);
        assertEquals("TMDB", saved.getSource());
        assertEquals("/new-poster.jpg", saved.getExternalPath());
        assertEquals("en", saved.getLanguageCode());
        assertEquals(2000, saved.getWidth());
        assertEquals(3000, saved.getHeight());
        assertEquals(MovieImageType.POSTER, saved.getImageType());
    }

    @Test
    void manualAddImageIsTaggedWithManualSource() {
        MovieImageRequest request = MovieImageRequest.builder()
                .imageUrl("https://example.com/manual.jpg")
                .imageType(MovieImageType.STILL)
                .build();
        when(movieImageRepository.save(any(MovieImage.class))).thenAnswer(inv -> inv.getArgument(0));
        when(movieMapper.toMovieImageResponse(any())).thenReturn(MovieImageResponse.builder().build());

        movieImageService.addImage(MOVIE_ID, request);

        ArgumentCaptor<MovieImage> captor = ArgumentCaptor.forClass(MovieImage.class);
        verify(movieImageRepository).save(captor.capture());
        assertEquals("MANUAL", captor.getValue().getSource());
    }
}
