import type { CastRequest, CreateMovieRequest } from "../../../api/movieApi";

/**
 * Structural subset of MovieEditorPage's FormState this needs - kept local (rather than
 * importing FormState directly) so this stays a standalone, easily-testable pure function with
 * no dependency on the page component. Passing the full form object still satisfies this.
 */
export type MoviePayloadFormFields = {
  originalTitle: string;
  originalLanguage: string;
  durationMinutes: number;
  releaseDate: string;
  country: string;
  ageRatingId: number | null;
  genreIds: number[];
  formatIds: number[];
  posterUrl: string;
  thumbnailUrl: string;
  trailerUrl: string;
  tmdbId?: number;
  imdbId?: string;
  vi_title: string;
  vi_synopsis: string;
  vi_tagline: string;
  en_title: string;
  en_synopsis: string;
  en_tagline: string;
};

/**
 * `[Frontend] Remove exhibition end date from Movie Editor`: builds the create/update payload
 * from form state. Deliberately has no `endDate` field at all - end date is an
 * exhibition/scheduling decision (see docs/MOVIE_SERVICE_BUSINESS_RULES.md), managed via the
 * availability/showtime workflow, not core content metadata. Never sending it here - not even
 * as `undefined`/`null` - means editing any other field can never clear an exhibition end date
 * already set on the backend (a partial update omits absent fields rather than nulling them).
 */
export function buildMoviePayload(
  sourceForm: MoviePayloadFormFields,
  resolvedCompanyIds: number[],
  resolvedCast: CastRequest[],
): CreateMovieRequest {
  const translations: { languageCode: string; title: string; synopsis?: string; tagline?: string }[] = [];
  if (sourceForm.vi_title.trim())
    translations.push({
      languageCode: "vi", title: sourceForm.vi_title.trim(),
      synopsis: sourceForm.vi_synopsis.trim() || undefined, tagline: sourceForm.vi_tagline.trim() || undefined,
    });
  if (sourceForm.en_title.trim())
    translations.push({
      languageCode: "en", title: sourceForm.en_title.trim(),
      synopsis: sourceForm.en_synopsis.trim() || undefined, tagline: sourceForm.en_tagline.trim() || undefined,
    });

  const canonicalSynopsis = sourceForm.originalLanguage.toLowerCase() === "vi"
    ? sourceForm.vi_synopsis.trim() || sourceForm.en_synopsis.trim()
    : sourceForm.en_synopsis.trim() || sourceForm.vi_synopsis.trim();

  const canonicalTagline = sourceForm.originalLanguage.toLowerCase() === "vi"
    ? sourceForm.vi_tagline.trim() || sourceForm.en_tagline.trim()
    : sourceForm.en_tagline.trim() || sourceForm.vi_tagline.trim();

  return {
    originalTitle: sourceForm.originalTitle.trim(),
    originalLanguage: sourceForm.originalLanguage,
    durationMinutes: sourceForm.durationMinutes,
    releaseDate: sourceForm.releaseDate || undefined,
    country: sourceForm.country.trim() || undefined,
    ageRatingId: sourceForm.ageRatingId ?? undefined,
    companyIds: resolvedCompanyIds,
    genreIds: sourceForm.genreIds,
    formatIds: sourceForm.formatIds,
    posterUrl: sourceForm.posterUrl.trim() || undefined,
    thumbnailUrl: sourceForm.thumbnailUrl.trim() || undefined,
    trailerUrl: sourceForm.trailerUrl.trim() || undefined,
    synopsis: canonicalSynopsis || undefined,
    tagline: canonicalTagline || undefined,
    tmdbId: sourceForm.tmdbId,
    imdbId: sourceForm.imdbId,
    translations: translations.length ? translations : undefined,
    cast: resolvedCast,
  };
}
