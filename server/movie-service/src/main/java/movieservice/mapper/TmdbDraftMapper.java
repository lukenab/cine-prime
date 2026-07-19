package movieservice.mapper;

import movieservice.dto.tmdb.TmdbCastDraft;
import movieservice.dto.tmdb.TmdbCompanyDraft;
import movieservice.dto.tmdb.TmdbCreditsResponse;
import movieservice.dto.tmdb.TmdbGenreDraft;
import movieservice.dto.tmdb.TmdbMovieDetail;
import movieservice.dto.tmdb.TmdbMovieDraft;
import movieservice.dto.tmdb.TmdbTranslationsResponse;
import movieservice.dto.tmdb.TranslationDraft;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * TMDB-FIX-02: single, repository-free normalization of a TMDB movie payload (details + credits +
 * translations) into a {@link TmdbMovieDraft}. Both TmdbService.getDetails() (preview) and
 * TmdbService.importMovie() (the real import command) call this same mapper so they can never
 * silently diverge on runtime, cast ordering, translation fallback or genre extraction - any
 * local resolution (matching companies/persons/genres/age-rating against the database) happens
 * downstream in TmdbService, never here.
 */
public final class TmdbDraftMapper {

    public static final String POSTER_BASE = "https://image.tmdb.org/t/p/w500";
    private static final int MAX_CAST = 15;

    private TmdbDraftMapper() {
    }

    public static TmdbMovieDraft toDraft(
            TmdbMovieDetail detail,
            TmdbCreditsResponse credits,
            TmdbTranslationsResponse translations) {

        List<String> warnings = new ArrayList<>();

        Integer runtime = (detail.getRuntime() != null && detail.getRuntime() > 0) ? detail.getRuntime() : null;
        if (runtime == null) {
            warnings.add("RUNTIME_MISSING");
        }

        String country = detail.getProductionCountries() == null
                ? null
                : detail.getProductionCountries().stream()
                        .map(TmdbMovieDetail.TmdbCountry::getName)
                        .filter(Objects::nonNull)
                        .filter(name -> !name.isBlank())
                        .collect(Collectors.joining(", "));

        return TmdbMovieDraft.builder()
                .tmdbId(detail.getId())
                .imdbId(detail.getImdbId())
                .originalTitle(detail.getOriginalTitle())
                .originalLanguage(detail.getOriginalLanguage() != null ? detail.getOriginalLanguage() : "en")
                .runtimeMinutes(runtime)
                .releaseDate(detail.getReleaseDate())
                .country(country)
                .posterUrl(buildPosterUrl(detail.getPosterPath()))
                .overview(detail.getOverview())
                .tagline(blankToNull(detail.getTagline()))
                .companies(buildCompanies(detail))
                .cast(buildCast(credits))
                .translations(buildTranslations(detail, translations))
                .genres(buildGenres(detail))
                .warnings(warnings)
                .build();
    }

    private static List<TmdbCompanyDraft> buildCompanies(TmdbMovieDetail detail) {
        List<TmdbCompanyDraft> companies = new ArrayList<>();
        if (detail.getProductionCompanies() != null) {
            for (TmdbMovieDetail.TmdbCompany c : detail.getProductionCompanies()) {
                if (c.getName() != null && !c.getName().isBlank()) {
                    companies.add(TmdbCompanyDraft.builder()
                            .tmdbId(c.getId())
                            .name(c.getName())
                            .country(c.getOriginCountry())
                            .logoUrl(buildPosterUrl(c.getLogoPath()))
                            .build());
                }
            }
        }
        return companies;
    }

    private static List<TmdbGenreDraft> buildGenres(TmdbMovieDetail detail) {
        List<TmdbGenreDraft> genres = new ArrayList<>();
        if (detail.getGenres() != null) {
            for (TmdbMovieDetail.TmdbGenre g : detail.getGenres()) {
                genres.add(TmdbGenreDraft.builder().tmdbGenreId(g.getId()).name(g.getName()).build());
            }
        }
        return genres;
    }

    private static List<TranslationDraft> buildTranslations(
            TmdbMovieDetail detail, TmdbTranslationsResponse translationsResp) {
        Map<String, TmdbTranslationsResponse.TranslationData> byLang = new HashMap<>();
        if (translationsResp.getTranslations() != null) {
            for (TmdbTranslationsResponse.Translation t : translationsResp.getTranslations()) {
                if (("vi".equals(t.getIso6391()) || "en".equals(t.getIso6391()))
                        && t.getData() != null
                        && t.getData().getTitle() != null
                        && !t.getData().getTitle().isBlank()) {
                    byLang.put(t.getIso6391(), t.getData());
                }
            }
        }

        List<TranslationDraft> result = new ArrayList<>();

        // English: fallback to originalTitle/overview/tagline if TMDB has no en translation.
        TmdbTranslationsResponse.TranslationData en = byLang.get("en");
        result.add(TranslationDraft.builder()
                .languageCode("en")
                .title(en != null ? en.getTitle() : detail.getOriginalTitle())
                .synopsis(en != null ? en.getOverview() : detail.getOverview())
                .tagline(en != null ? blankToNull(en.getTagline()) : blankToNull(detail.getTagline()))
                .build());

        // Vietnamese: only if TMDB has it.
        TmdbTranslationsResponse.TranslationData vi = byLang.get("vi");
        if (vi != null) {
            result.add(TranslationDraft.builder()
                    .languageCode("vi")
                    .title(vi.getTitle())
                    .synopsis(vi.getOverview())
                    .tagline(blankToNull(vi.getTagline()))
                    .build());
        }
        return result;
    }

    /** TMDB returns "" rather than omitting the field when a movie/translation has no tagline -
     *  never store that as a real value. */
    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }

    private static List<TmdbCastDraft> buildCast(TmdbCreditsResponse credits) {
        List<TmdbCastDraft> result = new ArrayList<>();

        if (credits.getCrew() != null) {
            credits.getCrew().stream()
                    .filter(item -> "Director".equals(item.getJob()) && item.getId() != null)
                    .forEach(item -> result.add(TmdbCastDraft.builder()
                            .tmdbPersonId(item.getId())
                            .name(item.getName())
                            .photoUrl(buildPosterUrl(item.getProfilePath()))
                            .roleType("DIRECTOR")
                            .build()));
        }

        if (credits.getCast() != null) {
            List<TmdbCreditsResponse.CastMember> actors = credits.getCast().stream()
                    .filter(item -> item.getId() != null)
                    .sorted(Comparator.comparingInt(item -> item.getOrder() != null ? item.getOrder() : 999))
                    .limit(MAX_CAST)
                    .toList();
            for (int i = 0; i < actors.size(); i++) {
                TmdbCreditsResponse.CastMember item = actors.get(i);
                result.add(TmdbCastDraft.builder()
                        .tmdbPersonId(item.getId())
                        .name(item.getName())
                        .photoUrl(buildPosterUrl(item.getProfilePath()))
                        .roleType("ACTOR")
                        .characterName(item.getCharacter())
                        .billingOrder(i + 1)
                        .build());
            }
        }
        return result;
    }

    private static String buildPosterUrl(String path) {
        return path != null ? POSTER_BASE + path : null;
    }
}
