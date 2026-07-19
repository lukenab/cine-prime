package movieservice.mapper;

import movieservice.dto.tmdb.TmdbCreditsResponse;
import movieservice.dto.tmdb.TmdbMovieDetail;
import movieservice.dto.tmdb.TmdbMovieDraft;
import movieservice.dto.tmdb.TmdbTranslationsResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * TMDB-FIX-02: TmdbDraftMapper is a pure function (no repository access) shared by preview and
 * import. These tests cover its normalization rules directly, without any Mockito/Spring wiring.
 */
class TmdbDraftMapperTest {

    private TmdbMovieDetail baseDetail() {
        TmdbMovieDetail detail = new TmdbMovieDetail();
        detail.setId(693134);
        detail.setOriginalTitle("Dune: Part Two");
        detail.setOriginalLanguage("en");
        detail.setOverview("Paul Atreides unites with Chani...");
        detail.setProductionCountries(List.of());
        detail.setProductionCompanies(List.of());
        detail.setGenres(List.of());
        return detail;
    }

    @Test
    void warnsWhenRuntimeMissingInsteadOfDefaulting() {
        TmdbMovieDetail detail = baseDetail();
        detail.setRuntime(null);

        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(detail, new TmdbCreditsResponse(), new TmdbTranslationsResponse());

        assertNull(draft.getRuntimeMinutes(), "Missing TMDB runtime must stay null, never default to 90");
        assertTrue(draft.getWarnings().contains("RUNTIME_MISSING"));
    }

    @Test
    void zeroRuntimeIsTreatedAsMissing() {
        TmdbMovieDetail detail = baseDetail();
        detail.setRuntime(0);

        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(detail, new TmdbCreditsResponse(), new TmdbTranslationsResponse());

        assertNull(draft.getRuntimeMinutes());
        assertTrue(draft.getWarnings().contains("RUNTIME_MISSING"));
    }

    @Test
    void keepsRealRuntimeWithoutWarning() {
        TmdbMovieDetail detail = baseDetail();
        detail.setRuntime(166);

        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(detail, new TmdbCreditsResponse(), new TmdbTranslationsResponse());

        assertEquals(166, draft.getRuntimeMinutes());
        assertFalse(draft.getWarnings().contains("RUNTIME_MISSING"));
    }

    @Test
    void englishTranslationFallsBackToOriginalTitleAndOverviewWhenTmdbHasNoEnTranslation() {
        TmdbMovieDetail detail = baseDetail();

        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(detail, new TmdbCreditsResponse(), new TmdbTranslationsResponse());

        assertEquals(1, draft.getTranslations().size());
        assertEquals("en", draft.getTranslations().get(0).getLanguageCode());
        assertEquals("Dune: Part Two", draft.getTranslations().get(0).getTitle());
        assertEquals(detail.getOverview(), draft.getTranslations().get(0).getSynopsis());
    }

    @Test
    void vietnameseTranslationOnlyIncludedWhenTmdbProvidesIt() {
        TmdbMovieDetail detail = baseDetail();
        TmdbTranslationsResponse translations = new TmdbTranslationsResponse();
        TmdbTranslationsResponse.Translation vi = new TmdbTranslationsResponse.Translation();
        vi.setIso6391("vi");
        TmdbTranslationsResponse.TranslationData data = new TmdbTranslationsResponse.TranslationData();
        data.setTitle("Hành Tinh Cát: Phần Hai");
        data.setOverview("Tóm tắt tiếng Việt");
        vi.setData(data);
        translations.setTranslations(List.of(vi));

        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(detail, new TmdbCreditsResponse(), translations);

        assertEquals(2, draft.getTranslations().size());
        assertEquals("vi", draft.getTranslations().get(1).getLanguageCode());
        assertEquals("Hành Tinh Cát: Phần Hai", draft.getTranslations().get(1).getTitle());
    }

    @Test
    void castIsDirectorsThenTopActorsCappedAtFifteenOrderedByBillingOrder() {
        TmdbMovieDetail detail = baseDetail();
        TmdbCreditsResponse credits = new TmdbCreditsResponse();

        TmdbCreditsResponse.CrewMember director = new TmdbCreditsResponse.CrewMember();
        director.setId(100);
        director.setName("Denis Villeneuve");
        director.setJob("Director");
        TmdbCreditsResponse.CrewMember producer = new TmdbCreditsResponse.CrewMember();
        producer.setId(101);
        producer.setName("Someone Else");
        producer.setJob("Producer");
        credits.setCrew(List.of(director, producer));

        List<TmdbCreditsResponse.CastMember> actors = new java.util.ArrayList<>();
        for (int i = 0; i < 20; i++) {
            TmdbCreditsResponse.CastMember actor = new TmdbCreditsResponse.CastMember();
            actor.setId(200 + i);
            actor.setName("Actor " + i);
            actor.setOrder(20 - i); // reverse order on purpose
            actors.add(actor);
        }
        credits.setCast(actors);

        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(detail, credits, new TmdbTranslationsResponse());

        // Only the Director crew member is included, not the Producer.
        assertEquals(1, draft.getCast().stream().filter(c -> "DIRECTOR".equals(c.getRoleType())).count());
        // Actors capped at MAX_CAST=15.
        assertEquals(15, draft.getCast().stream().filter(c -> "ACTOR".equals(c.getRoleType())).count());
        // Lowest TMDB `order` value comes first (billingOrder=1).
        assertEquals(219, draft.getCast().get(1).getTmdbPersonId());
        assertEquals(1, draft.getCast().get(1).getBillingOrder());
    }

    // ── `[Backend] Add tagline field to Movie and MovieTranslation entities` ────────

    @Test
    void taglineIsCopiedFromDetailToTheDraft() {
        TmdbMovieDetail detail = baseDetail();
        detail.setTagline("Fear is a choice.");

        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(detail, new TmdbCreditsResponse(), new TmdbTranslationsResponse());

        assertEquals("Fear is a choice.", draft.getTagline());
    }

    @Test
    void blankTaglineIsNormalizedToNullNotStoredAsEmptyString() {
        TmdbMovieDetail detail = baseDetail();
        detail.setTagline("   ");

        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(detail, new TmdbCreditsResponse(), new TmdbTranslationsResponse());

        assertNull(draft.getTagline());
    }

    @Test
    void englishTranslationTaglineFallsBackToDetailTaglineWhenTmdbHasNoEnTranslation() {
        TmdbMovieDetail detail = baseDetail();
        detail.setTagline("Fear is a choice.");

        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(detail, new TmdbCreditsResponse(), new TmdbTranslationsResponse());

        assertEquals("Fear is a choice.", draft.getTranslations().get(0).getTagline());
    }

    @Test
    void vietnameseTranslationTaglineOnlyIncludedWhenTmdbProvidesIt() {
        TmdbMovieDetail detail = baseDetail();
        TmdbTranslationsResponse translations = new TmdbTranslationsResponse();
        TmdbTranslationsResponse.Translation vi = new TmdbTranslationsResponse.Translation();
        vi.setIso6391("vi");
        TmdbTranslationsResponse.TranslationData data = new TmdbTranslationsResponse.TranslationData();
        data.setTitle("Hành Tinh Cát: Phần Hai");
        data.setOverview("Tóm tắt tiếng Việt");
        data.setTagline("Nỗi sợ là một lựa chọn.");
        vi.setData(data);
        translations.setTranslations(List.of(vi));

        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(detail, new TmdbCreditsResponse(), translations);

        assertEquals("Nỗi sợ là một lựa chọn.", draft.getTranslations().get(1).getTagline());
    }

    @Test
    void missingTaglineNeverAddsAWarningOrBlocksMapping() {
        TmdbMovieDetail detail = baseDetail();
        detail.setTagline(null);

        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(detail, new TmdbCreditsResponse(), new TmdbTranslationsResponse());

        assertNull(draft.getTagline());
        assertTrue(draft.getWarnings().stream().noneMatch(w -> w.toLowerCase().contains("tagline")));
    }

    @Test
    void genresAreExtractedAsRawTmdbIdAndNameWithoutAnyLocalResolution() {
        TmdbMovieDetail detail = baseDetail();
        TmdbMovieDetail.TmdbGenre genre = new TmdbMovieDetail.TmdbGenre();
        genre.setId(878);
        genre.setName("Science Fiction");
        detail.setGenres(List.of(genre));

        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(detail, new TmdbCreditsResponse(), new TmdbTranslationsResponse());

        assertEquals(1, draft.getGenres().size());
        assertEquals(878, draft.getGenres().get(0).getTmdbGenreId());
        assertEquals("Science Fiction", draft.getGenres().get(0).getName());
    }
}
