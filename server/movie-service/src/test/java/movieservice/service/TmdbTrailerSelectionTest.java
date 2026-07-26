package movieservice.service;

import movieservice.dto.response.TmdbMovieDetailsResponse;
import movieservice.dto.tmdb.TmdbConfigurationResponse;
import movieservice.dto.tmdb.TmdbCreditsResponse;
import movieservice.dto.tmdb.TmdbImagesResponse;
import movieservice.dto.tmdb.TmdbMovieDetail;
import movieservice.dto.tmdb.TmdbReleaseDatesResponse;
import movieservice.dto.tmdb.TmdbTranslationsResponse;
import movieservice.dto.tmdb.TmdbVideosResponse;
import movieservice.repository.AgeRatingRepository;
import movieservice.repository.GenreRepository;
import movieservice.repository.MovieCastRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.MovieSchedulingProfileRepository;
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
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * [Backend] Fetch and select an official TMDB trailer. Selection is private (selectTrailer),
 * so exercised black-box through the public getDetails() preview - same entry point as
 * TmdbImageSelectionTest for the image-selection heuristics.
 */
@ExtendWith(MockitoExtension.class)
class TmdbTrailerSelectionTest {

    @Mock MovieRepository movieRepository;
    @Mock MovieTranslationRepository movieTranslationRepository;
    @Mock MovieCastRepository movieCastRepository;
    @Mock PersonRepository personRepository;
    @Mock ProductionCompanyRepository productionCompanyRepository;
    @Mock GenreRepository genreRepository;
    @Mock AgeRatingRepository ageRatingRepository;
    @Mock MovieSchedulingProfileRepository movieSchedulingProfileRepository;
    @Mock RestTemplate restTemplate;

    TmdbService tmdbService;

    private static final int TMDB_ID = 1368337;

    @BeforeEach
    void setUp() {
        tmdbService = new TmdbService(
                movieRepository, movieTranslationRepository, movieCastRepository, personRepository,
                productionCompanyRepository, genreRepository, ageRatingRepository,
                movieSchedulingProfileRepository, "dummy-api-key", 3);
        ReflectionTestUtils.setField(tmdbService, "restTemplate", restTemplate);

        TmdbMovieDetail detail = new TmdbMovieDetail();
        detail.setId(TMDB_ID);
        detail.setOriginalTitle("The Odyssey");
        detail.setOriginalLanguage("en");
        detail.setRuntime(140);
        detail.setReleaseDate("2026-07-17");
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
                .thenReturn(null);
        when(restTemplate.getForObject(any(URI.class), eq(TmdbImagesResponse.class)))
                .thenReturn(new TmdbImagesResponse());
    }

    private TmdbVideosResponse.TmdbVideoItem video(String key, String site, String type, Boolean official, String lang) {
        TmdbVideosResponse.TmdbVideoItem item = new TmdbVideosResponse.TmdbVideoItem();
        item.setKey(key);
        item.setSite(site);
        item.setType(type);
        item.setOfficial(official);
        item.setIso6391(lang);
        return item;
    }

    private void stubVideos(List<TmdbVideosResponse.TmdbVideoItem> results) {
        TmdbVideosResponse videos = new TmdbVideosResponse();
        videos.setResults(results);
        when(restTemplate.getForObject(any(URI.class), eq(TmdbVideosResponse.class))).thenReturn(videos);
    }

    @Test
    void picksOfficialTrailerOverNonOfficialOne() {
        stubVideos(List.of(
                video("nonOfficialKey", "YouTube", "Trailer", false, "en"),
                video("officialKey", "YouTube", "Trailer", true, "en")
        ));

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        assertEquals("https://www.youtube.com/watch?v=officialKey", response.getTrailerUrl());
        assertTrue(response.getTrailerOfficial());
        assertEquals("YOUTUBE", response.getTrailerProvider());
        assertEquals("officialKey", response.getTrailerExternalKey());
        assertEquals("TRAILER", response.getTrailerVideoType());
    }

    @Test
    void prefersVietnameseTrailerOverEnglishOne() {
        stubVideos(List.of(
                video("enKey", "YouTube", "Trailer", true, "en"),
                video("viKey", "YouTube", "Trailer", true, "vi")
        ));

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        assertEquals("viKey", response.getTrailerExternalKey());
        assertEquals("vi", response.getTrailerLanguageCode());
    }

    @Test
    void ignoresNonYouTubeSites() {
        stubVideos(List.of(
                video("vimeoKey", "Vimeo", "Trailer", true, "en"),
                video("ytKey", "YouTube", "Trailer", false, "en")
        ));

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        assertEquals("ytKey", response.getTrailerExternalKey());
    }

    @Test
    void fallsBackToTeaserOnlyWhenNoTrailerExistsAndWarns() {
        stubVideos(List.of(
                video("teaserKey", "YouTube", "Teaser", true, "en")
        ));

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        assertEquals("teaserKey", response.getTrailerExternalKey());
        assertEquals("TEASER", response.getTrailerVideoType());
        assertTrue(response.getWarnings().contains("TRAILER_FALLBACK_TEASER:teaserKey"),
                "Falling back to a teaser must always be flagged with a warning");
    }

    @Test
    void neverFallsBackToTeaserWhenATrailerExists() {
        stubVideos(List.of(
                video("teaserKey", "YouTube", "Teaser", true, "en"),
                video("trailerKey", "YouTube", "Trailer", false, "en")
        ));

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        assertEquals("trailerKey", response.getTrailerExternalKey());
        assertFalse(response.getWarnings().stream().anyMatch(w -> w.startsWith("TRAILER_FALLBACK_TEASER")));
    }

    @Test
    void noEligibleVideoDoesNotFailPreviewAndWarns() {
        stubVideos(List.of());

        TmdbMovieDetailsResponse response = tmdbService.getDetails(TMDB_ID);

        assertNull(response.getTrailerUrl());
        assertTrue(response.getWarnings().contains("TRAILER_NOT_FOUND"));
    }
}
