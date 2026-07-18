package movieservice.service;

import movieservice.dto.response.MovieMediaCandidateResponse;
import movieservice.dto.response.TmdbMovieDetailsResponse;
import movieservice.dto.tmdb.TmdbConfigurationResponse;
import movieservice.dto.tmdb.TmdbCreditsResponse;
import movieservice.dto.tmdb.TmdbImagesResponse;
import movieservice.dto.tmdb.TmdbMovieDetail;
import movieservice.dto.tmdb.TmdbReleaseDatesResponse;
import movieservice.dto.tmdb.TmdbTranslationsResponse;
import movieservice.repository.AgeRatingRepository;
import movieservice.repository.GenreRepository;
import movieservice.repository.MovieCastRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.MovieTranslationRepository;
import movieservice.repository.PersonRepository;
import movieservice.repository.ProductionCompanyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * TMDB-FIX-05: image selection/recommendation heuristics (locale, resolution, aspect ratio,
 * vote score) exercised through the public getDetails() preview - the ranking logic itself
 * (buildMediaPreview) is private, so this is deliberately black-box through the same entry
 * point the controller actually calls.
 */
@ExtendWith(MockitoExtension.class)
class TmdbImageSelectionTest {

    @Mock MovieRepository movieRepository;
    @Mock MovieTranslationRepository movieTranslationRepository;
    @Mock MovieCastRepository movieCastRepository;
    @Mock PersonRepository personRepository;
    @Mock ProductionCompanyRepository productionCompanyRepository;
    @Mock GenreRepository genreRepository;
    @Mock AgeRatingRepository ageRatingRepository;
    @Mock RestTemplate restTemplate;

    TmdbService tmdbService;

    private static final int TMDB_ID = 693134;

    @BeforeEach
    void setUp() {
        tmdbService = new TmdbService(
                movieRepository, movieTranslationRepository, movieCastRepository, personRepository,
                productionCompanyRepository, genreRepository, ageRatingRepository, "dummy-api-key", 3);
        ReflectionTestUtils.setField(tmdbService, "restTemplate", restTemplate);

        TmdbMovieDetail detail = new TmdbMovieDetail();
        detail.setId(TMDB_ID);
        detail.setOriginalTitle("Dune: Part Two");
        detail.setOriginalLanguage("en");
        detail.setRuntime(166);
        detail.setReleaseDate("2024-02-27");
        detail.setProductionCountries(List.of());
        detail.setProductionCompanies(List.of());
        detail.setGenres(List.of());

        when(restTemplate.getForObject(any(URI.class), eq(TmdbMovieDetail.class))).thenReturn(detail);
        when(restTemplate.getForObject(any(URI.class), eq(TmdbCreditsResponse.class)))
                .thenReturn(new TmdbCreditsResponse());
        when(restTemplate.getForObject(any(URI.class), eq(TmdbTranslationsResponse.class)))
                .thenReturn(new TmdbTranslationsResponse());
        when(restTemplate.getForObject(any(URI.class), eq(TmdbReleaseDatesResponse.class)))
                .thenReturn(new TmdbReleaseDatesResponse());
        when(restTemplate.getForObject(any(URI.class), eq(TmdbConfigurationResponse.class)))
                .thenReturn(null); // forces the built-in fallback config (still exercises that path)
    }

    private TmdbImagesResponse.TmdbImageItem poster(String path, String lang, double vote, int width, int height) {
        TmdbImagesResponse.TmdbImageItem item = new TmdbImagesResponse.TmdbImageItem();
        item.setFilePath(path);
        item.setIso6391(lang);
        item.setVoteAverage(vote);
        item.setWidth(width);
        item.setHeight(height);
        item.setAspectRatio(width / (double) height);
        return item;
    }

    private void stubImages(List<TmdbImagesResponse.TmdbImageItem> posters, List<TmdbImagesResponse.TmdbImageItem> backdrops) {
        TmdbImagesResponse images = new TmdbImagesResponse();
        images.setPosters(posters);
        images.setBackdrops(backdrops);
        when(restTemplate.getForObject(any(URI.class), eq(TmdbImagesResponse.class))).thenReturn(images);
    }

    @Test
    void recommendsVietnamesePosterOverHigherVotedEnglishOne() {
        stubImages(List.of(
                poster("/en-high-vote.jpg", "en", 9.0, 2000, 3000),
                poster("/vi-lower-vote.jpg", "vi", 6.0, 2000, 3000)
        ), List.of());

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        assertEquals("/vi-lower-vote.jpg", response.getMedia().getRecommendedPosterPath(),
                "Locale match (vi) must outrank a higher vote_average in a non-priority language");
        assertTrue(response.getPosterUrl().endsWith("/vi-lower-vote.jpg"));
    }

    @Test
    void recommendsHigherVoteWithinSameLanguageTier() {
        stubImages(List.of(
                poster("/en-vote-6.jpg", "en", 6.0, 2000, 3000),
                poster("/en-vote-9.jpg", "en", 9.0, 2000, 3000)
        ), List.of());

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        assertEquals("/en-vote-9.jpg", response.getMedia().getRecommendedPosterPath());
    }

    @Test
    void thumbnailUrlIsASmallerSizeThanPosterUrlForTheSameAsset() {
        stubImages(List.of(poster("/only.jpg", "en", 8.0, 2000, 3000)), List.of());

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        assertTrue(response.getPosterUrl().contains("/only.jpg"));
        assertTrue(response.getThumbnailUrl().contains("/only.jpg"));
        assertFalse(response.getPosterUrl().equals(response.getThumbnailUrl()),
                "posterUrl and thumbnailUrl must be different CDN size derivatives of the same asset, not a literal copy");
    }

    @Test
    void filtersOutPosterWithWrongAspectRatioForCategory() {
        // A 16:9-shaped image mistagged as a poster - outside the poster aspect-ratio band.
        TmdbImagesResponse.TmdbImageItem wrongShape = poster("/mistagged-backdrop-shape.jpg", "en", 9.9, 1920, 1080);
        TmdbImagesResponse.TmdbImageItem properPoster = poster("/proper.jpg", "en", 1.0, 2000, 3000);
        stubImages(List.of(wrongShape, properPoster), List.of());

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        assertEquals("/proper.jpg", response.getMedia().getRecommendedPosterPath());
        assertTrue(response.getMedia().getPosters().stream()
                .noneMatch(c -> c.getFilePath().equals("/mistagged-backdrop-shape.jpg")));
    }

    @Test
    void dedupesRepeatedFilePathWithinTmdbsOwnResponse() {
        stubImages(List.of(
                poster("/dup.jpg", "en", 5.0, 2000, 3000),
                poster("/dup.jpg", "en", 5.0, 2000, 3000)
        ), List.of());

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        assertEquals(1, response.getMedia().getPosters().size());
    }

    @Test
    void capsStillsAtConfiguredMaximumAndExcludesTheRecommendedBackdrop() {
        List<TmdbImagesResponse.TmdbImageItem> backdrops = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            TmdbImagesResponse.TmdbImageItem item = new TmdbImagesResponse.TmdbImageItem();
            item.setFilePath("/backdrop-" + i + ".jpg");
            item.setIso6391(null);
            item.setVoteAverage(10.0 - i); // strictly descending so ordering is deterministic
            item.setWidth(1920);
            item.setHeight(1080);
            item.setAspectRatio(1920.0 / 1080.0);
            backdrops.add(item);
        }
        stubImages(List.of(), backdrops);

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        assertEquals("/backdrop-0.jpg", response.getMedia().getRecommendedBackdropPath());
        // maxStills = 3 (constructor arg in setUp()) - recommended backdrop is excluded from stills.
        assertEquals(3, response.getMedia().getStills().size());
        assertTrue(response.getMedia().getStills().stream()
                .noneMatch(c -> c.getFilePath().equals("/backdrop-0.jpg")));
        assertEquals("/backdrop-1.jpg", response.getMedia().getStills().get(0).getFilePath());
    }

    @Test
    void missingPosterFallsBackGracefullyAndWarns() {
        stubImages(List.of(), List.of());

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        assertNull(response.getMedia().getRecommendedPosterPath());
        assertNull(response.getPosterUrl(), "No TMDB detail poster_path and no image candidate - nothing to fall back to");
        assertTrue(response.getWarnings().contains("POSTER_NOT_AVAILABLE"));
    }

    @Test
    void recommendedCandidateIsMarkedInItsOwnList() {
        stubImages(List.of(poster("/only.jpg", "en", 8.0, 2000, 3000)), List.of());

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        MovieMediaCandidateResponse only = response.getMedia().getPosters().get(0);
        assertTrue(only.isRecommended());
    }
}
