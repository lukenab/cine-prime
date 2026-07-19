package movieservice.dto.tmdb;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * Pure, repository-free normalization of a TMDB movie payload (details + credits + translations).
 * Produced once by TmdbDraftMapper and consumed identically by preview (TmdbService.getDetails())
 * and import (TmdbService.importMovie()) so the two paths cannot silently diverge - see TMDB-FIX-02.
 * Local resolution (matching companies/persons/genres/age-rating against the database) happens
 * downstream in TmdbService, never inside this draft or its mapper.
 */
@Getter
@Builder
public class TmdbMovieDraft {
    Integer tmdbId;
    String imdbId;
    String originalTitle;
    String originalLanguage;
    Integer runtimeMinutes;
    String releaseDate;
    String country;
    String posterUrl;
    String overview;
    String tagline;
    List<TmdbCompanyDraft> companies;
    List<TmdbCastDraft> cast;
    List<TranslationDraft> translations;
    List<TmdbGenreDraft> genres;
    List<String> warnings;
}
