import {
  X, Film, Upload, Loader2, Search, GripVertical, Trash2,
  AlertCircle, Check, Tag, Globe, Users, Images, ArrowLeft,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  movieApi,
  type GenreResponse,
  type ScreeningFormatResponse,
  type AgeRatingResponse,
  type ProductionCompanyResponse,
  type PersonResponse,
  type TmdbSearchItem,
  type CastRequest,
  type CreateMovieRequest,
  type UpdateMovieRequest,
  type MovieV2,
  type MovieImageResponse,
  type MovieImageRequest,
  type MovieMediaPreview,
  type MovieImageType,
  type TmdbGenrePreview,
  type TmdbMovieDetails,
} from "../../api/movieApi";
import {
  MOVIE_CONTENT_STATUS_META,
  toMovieContentStatus,
} from "../../utils/movieContentStatus";
import {
  classifyWarnings,
  groupWarnings,
  WARNING_GROUP_LABELS,
  WARNING_GROUP_ORDER,
  type ClassifiedWarning,
} from "../../utils/tmdbWarnings";
import { TmdbMediaPicker } from "../../layouts/TmdbMediaPicker";
import { useRole } from "../../hooks/useRole";

// ─────────────────────────────────────────────────────────────────────────────
// Local types (same shape as the previous MovieModal)
// ─────────────────────────────────────────────────────────────────────────────

type CastRow = {
  _key: string;
  personId: number | null;
  tmdbPersonId?: number;
  fullName: string;
  photoUrl?: string;
  roleType: "ACTOR" | "DIRECTOR";
  characterName: string;
};

/** Issue #151: a movie can link several production companies. companyId is null for a
 *  company picked up from a TMDB preview that hasn't been created locally yet - resolved to a
 *  real ID (via movieApi.createCompany) right before submit, same as the old single-company flow. */
type SelectedCompany = { companyId: number | null; name: string; country?: string; logoUrl?: string };

type FormState = {
  originalTitle: string;
  originalLanguage: string;
  durationMinutes: number;
  releaseDate: string;
  endDate: string;
  country: string;
  ageRatingId: number | null;
  selectedCompanies: SelectedCompany[];
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
  cast: CastRow[];
};

const emptyForm: FormState = {
  originalTitle: "",
  originalLanguage: "en",
  durationMinutes: 120,
  releaseDate: "",
  endDate: "",
  country: "",
  ageRatingId: null,
  selectedCompanies: [],
  genreIds: [],
  formatIds: [],
  posterUrl: "",
  thumbnailUrl: "",
  trailerUrl: "",
  vi_title: "",
  vi_synopsis: "",
  vi_tagline: "",
  en_title: "",
  en_synopsis: "",
  en_tagline: "",
  cast: [],
};

function movieToForm(mv: MovieV2): FormState {
  const vi = mv.translations?.find((t) => t.languageCode === "vi");
  const en = mv.translations?.find((t) => t.languageCode === "en");
  const originalIsVietnamese = mv.originalLanguage?.toLowerCase() === "vi";
  return {
    originalTitle: mv.originalTitle ?? "",
    originalLanguage: mv.originalLanguage ?? "en",
    durationMinutes: mv.durationMinutes ?? 120,
    releaseDate: mv.releaseDate ?? "",
    endDate: mv.endDate ?? "",
    country: mv.country ?? "",
    ageRatingId: mv.ageRating?.ratingId ?? null,
    selectedCompanies: mv.companies?.map((c) => ({
      companyId: c.companyId, name: c.name, country: c.country, logoUrl: c.logoUrl,
    })) ?? [],
    genreIds: mv.genres?.map((g) => g.genreId) ?? [],
    formatIds: mv.formats?.map((f) => f.formatId) ?? [],
    posterUrl: mv.posterUrl ?? "",
    thumbnailUrl: mv.thumbnailUrl ?? "",
    trailerUrl: mv.trailerUrl ?? "",
    tmdbId: mv.tmdbId,
    imdbId: mv.imdbId,
    vi_title: vi?.title ?? "",
    vi_synopsis: vi?.synopsis ?? (originalIsVietnamese ? mv.synopsis : "") ?? "",
    vi_tagline: vi?.tagline ?? (originalIsVietnamese ? mv.tagline : "") ?? "",
    en_title: en?.title ?? "",
    en_synopsis: en?.synopsis ?? (!originalIsVietnamese ? mv.synopsis : "") ?? "",
    en_tagline: en?.tagline ?? (!originalIsVietnamese ? mv.tagline : "") ?? "",
    cast:
      mv.cast?.map((c, i) => ({
        _key: `${c.personId}-${i}`,
        personId: c.personId,
        fullName: c.fullName,
        photoUrl: c.photoUrl,
        roleType: c.roleType === "DIRECTOR" ? "DIRECTOR" : "ACTOR",
        characterName: c.characterName ?? "",
      })) ?? [],
  };
}

const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "vi", label: "Tiếng Việt (Vietnamese)" },
  { code: "ko", label: "한국어 (Korean)" },
  { code: "ja", label: "日本語 (Japanese)" },
  { code: "zh", label: "中文 (Chinese)" },
  { code: "fr", label: "Français" },
  { code: "th", label: "ภาษาไทย (Thai)" },
];

const IS: React.CSSProperties = {
  fontSize: "14px",
  background: "var(--bg-main)",
  color: "var(--text-main)",
  border: "1px solid var(--border-color)",
};
const IC = "w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors";
const FL: React.CSSProperties = { fontSize: "13px", color: "var(--text-sub)", display: "block", marginBottom: "6px" };
const SL: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em",
  textTransform: "uppercase", color: "var(--text-sub)", marginBottom: "12px",
};

/**
 * Dedicated Create/Edit Movie page (replaces the old MovieModal). A movie's full editing
 * surface — TMDB import, poster/gallery previews, genre/format chips, bilingual titles,
 * cast reordering — genuinely needs more room than a centered modal: dropdowns were getting
 * clipped, the TMDB search was a modal stacked on top of the modal, and image previews were
 * squeezed into a 2-column grid. Two-column layout mirrors the Cinema Room creation page:
 * form sections scroll on the left, poster/TMDB/gallery live in a docked right column.
 */
export default function MovieEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAdmin } = useRole();
  const { movieId: movieIdParam } = useParams<{ movieId: string }>();
  const editMovieId = movieIdParam ? Number(movieIdParam) : null;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [loadingMovie, setLoadingMovie] = useState(!!editMovieId);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const currentContentStatus = currentStatus ? toMovieContentStatus(currentStatus) : null;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [genres, setGenres] = useState<GenreResponse[]>([]);
  const [formats, setFormats] = useState<ScreeningFormatResponse[]>([]);
  const [ageRatings, setAgeRatings] = useState<AgeRatingResponse[]>([]);

  const [uploadingImg, setUploadingImg] = useState<"posterUrl" | "thumbnailUrl" | null>(null);
  const [uploadError, setUploadError] = useState("");

  // TMDB catalog hand-off: browsing happens on a dedicated full-width page.
  const [catalogApplying, setCatalogApplying] = useState(false);
  const catalogImportStarted = useRef<number | null>(null);

  // ── `[Frontend] Show TMDB import warnings/mappings/media preview` ─────────
  // Review surface shown after applying a TMDB result - grouped/severity-tagged warnings,
  // genre-mapping resolution (map existing / create new / ignore with reason), the suggested
  // trailer, and which fields came from TMDB unverified. Genre resolution gates Save; nothing
  // else here is a "resync" (no backend support for that exists yet - out of scope, disclosed).
  const [tmdbWarnings, setTmdbWarnings] = useState<ClassifiedWarning[]>([]);
  const [tmdbUnmappedGenres, setTmdbUnmappedGenres] = useState<TmdbGenrePreview[]>([]);
  const [genreResolutions, setGenreResolutions] = useState<
    Record<number, { action: "mapped" | "created" | "ignored"; reason?: string }>
  >({});
  const [ignoreReasonDraft, setIgnoreReasonDraft] = useState<Record<number, string>>({});
  const [creatingGenreId, setCreatingGenreId] = useState<number | null>(null);
  const [tmdbTrailer, setTmdbTrailer] = useState<{ url: string; videoType?: string } | null>(null);
  const [tmdbUnverified, setTmdbUnverified] = useState<{ releaseDate: boolean; ageRatingId: boolean }>({
    releaseDate: false,
    ageRatingId: false,
  });

  // TMDB-FIX-05: media candidates from the last applyTmdb(), and the admin's pending
  // poster/backdrop/still selections (imported right after save if the movie is new).
  const [tmdbMedia, setTmdbMedia] = useState<MovieMediaPreview | null>(null);
  const [pendingMediaSelections, setPendingMediaSelections] = useState<{ filePath: string; imageType: MovieImageType }[]>([]);

  const [companyQ, setCompanyQ] = useState("");
  const [companies, setCompanies] = useState<ProductionCompanyResponse[]>([]);
  const [showCompanyDrop, setShowCompanyDrop] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const companyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companyRef = useRef<HTMLDivElement>(null);

  const [personQ, setPersonQ] = useState("");
  const [personResults, setPersonResults] = useState<PersonResponse[]>([]);
  const [showPersonDrop, setShowPersonDrop] = useState(false);
  const [personLoading, setPersonLoading] = useState(false);
  const personTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const personRef = useRef<HTMLDivElement>(null);

  const [langTab, setLangTab] = useState<"vi" | "en">("vi");
  const dragIdx = useRef<number>(-1);

  const [movieImages, setMovieImages] = useState<MovieImageResponse[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [imageType, setImageType] = useState<MovieImageRequest["imageType"]>("STILL");
  const [imageCaption, setImageCaption] = useState("");
  const [addingImage, setAddingImage] = useState(false);

  const [localEditId, setLocalEditId] = useState<number | null>(null);
  const activeMovieId = localEditId ?? editMovieId;

  // ── Load movie when editing ────────────────────────────────
  useEffect(() => {
    if (!editMovieId) return;
    setLoadingMovie(true);
    movieApi
      .getMovieById(editMovieId)
      .then((res) => {
        const mv = res.result;
        setCurrentStatus(mv.status);
        setForm(movieToForm(mv));
        if (mv.images?.length) setMovieImages(mv.images);
        else movieApi.getMovieImages(editMovieId).then((r) => setMovieImages(r.result ?? [])).catch(() => {});
      })
      .catch(() => setError("Failed to load movie."))
      .finally(() => setLoadingMovie(false));
  }, [editMovieId]);

  useEffect(() => {
    movieApi.getGenres().then((r) => setGenres(r.result ?? [])).catch(() => {});
    movieApi.getScreeningFormats().then((r) => setFormats(r.result ?? [])).catch(() => {});
    movieApi.getAgeRatings().then((r) => setAgeRatings(r.result ?? [])).catch(() => {});
  }, []);

  // Distinguishes a TMDB rate-limit (429) from any other upstream/network failure so the
  // banner tells the admin something actionable instead of a generic "something went wrong".
  const describeTmdbFetchError = (e: any): string =>
    e?.response?.status === 429
      ? "TMDB rate limit reached — please wait a moment and try again."
      : e?.response?.data?.message ?? "Couldn't reach TMDB. Please try again.";

  useEffect(() => {
    if (companyTimer.current) clearTimeout(companyTimer.current);
    if (!companyQ.trim()) { setCompanies([]); return; }
    companyTimer.current = setTimeout(() => {
      setCompanyLoading(true);
      movieApi.searchCompanies(companyQ)
        .then((r) => setCompanies(r.result ?? []))
        .catch(() => {})
        .finally(() => setCompanyLoading(false));
    }, 300);
  }, [companyQ]);

  useEffect(() => {
    if (personTimer.current) clearTimeout(personTimer.current);
    if (!personQ.trim()) { setPersonResults([]); return; }
    personTimer.current = setTimeout(() => {
      setPersonLoading(true);
      movieApi.searchPersons(personQ)
        .then((r) => setPersonResults(r.result ?? []))
        .catch(() => {})
        .finally(() => setPersonLoading(false));
    }, 300);
  }, [personQ]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node))
        setShowCompanyDrop(false);
      if (personRef.current && !personRef.current.contains(e.target as Node))
        setShowPersonDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: val }));

  const fmtDuration = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  };

  const buildPayload = (
    resolvedCompanyIds: number[],
    resolvedCast: CastRequest[]
  ): CreateMovieRequest => {
    const translations: { languageCode: string; title: string; synopsis?: string; tagline?: string }[] = [];
    if (form.vi_title.trim())
      translations.push({
        languageCode: "vi", title: form.vi_title.trim(),
        synopsis: form.vi_synopsis.trim() || undefined, tagline: form.vi_tagline.trim() || undefined,
      });
    if (form.en_title.trim())
      translations.push({
        languageCode: "en", title: form.en_title.trim(),
        synopsis: form.en_synopsis.trim() || undefined, tagline: form.en_tagline.trim() || undefined,
      });

    const canonicalSynopsis = form.originalLanguage.toLowerCase() === "vi"
      ? form.vi_synopsis.trim() || form.en_synopsis.trim()
      : form.en_synopsis.trim() || form.vi_synopsis.trim();

    // `[Backend] Add tagline field to Movie and MovieTranslation entities`: derived the same
    // way canonicalSynopsis is - no separate "original tagline" input, mirrors the existing
    // synopsis convention exactly.
    const canonicalTagline = form.originalLanguage.toLowerCase() === "vi"
      ? form.vi_tagline.trim() || form.en_tagline.trim()
      : form.en_tagline.trim() || form.vi_tagline.trim();

    return {
      originalTitle: form.originalTitle.trim(),
      originalLanguage: form.originalLanguage,
      durationMinutes: form.durationMinutes,
      releaseDate: form.releaseDate || undefined,
      endDate: form.endDate || undefined,
      country: form.country.trim() || undefined,
      ageRatingId: form.ageRatingId ?? undefined,
      companyIds: resolvedCompanyIds,
      genreIds: form.genreIds,
      formatIds: form.formatIds,
      posterUrl: form.posterUrl.trim() || undefined,
      thumbnailUrl: form.thumbnailUrl.trim() || undefined,
      trailerUrl: form.trailerUrl.trim() || undefined,
      synopsis: canonicalSynopsis || undefined,
      tagline: canonicalTagline || undefined,
      tmdbId: form.tmdbId,
      imdbId: form.imdbId,
      translations: translations.length ? translations : undefined,
      cast: resolvedCast,
    };
  };

  /** Creates a local ProductionCompany row for each TMDB-sourced pick that has no companyId
   *  yet, and returns the final list of resolved IDs. Existing companies pass straight through. */
  const resolveCompanyIds = async (): Promise<{ ids: number[]; resolved: SelectedCompany[] }> => {
    const resolved: SelectedCompany[] = [];
    for (const c of form.selectedCompanies) {
      if (c.companyId != null) {
        resolved.push(c);
        continue;
      }
      const created = await movieApi.createCompany({ name: c.name, country: c.country, logoUrl: c.logoUrl });
      resolved.push({ ...c, companyId: created.result.companyId });
    }
    return { ids: resolved.map((c) => c.companyId!), resolved };
  };

  const resolveCastPersonIds = async (): Promise<CastRequest[]> => {
    const resolved: CastRequest[] = [];
    for (let i = 0; i < form.cast.length; i++) {
      const c = form.cast[i];
      let personId = c.personId;
      if (personId == null) {
        const created = await movieApi.createPerson({
          fullName: c.fullName,
          photoUrl: c.photoUrl,
          tmdbId: c.tmdbPersonId,
        });
        personId = created.result.personId;
      }
      resolved.push({
        personId,
        roleType: c.roleType,
        characterName: c.characterName.trim() || undefined,
        billingOrder: i + 1,
      });
    }
    return resolved;
  };

  const validate = (): { ok: boolean; msg?: string } => {
    if (!form.originalTitle.trim()) return { ok: false, msg: "Please enter the original title." };
    if (!form.durationMinutes || form.durationMinutes < 1) return { ok: false, msg: "Duration must be ≥ 1 minute." };
    if (form.genreIds.length === 0) return { ok: false, msg: "Select at least 1 genre." };
    if (form.formatIds.length === 0) return { ok: false, msg: "Select at least 1 screening format." };
    if (hasBlockingTmdbIssues) {
      return {
        ok: false,
        msg: `Resolve ${unresolvedTmdbGenres.length} unmapped TMDB genre(s) below before saving.`,
      };
    }
    return { ok: true };
  };

  const importPendingMediaInto = async (movieId: number) => {
    if (!form.tmdbId || pendingMediaSelections.length === 0) return;
    try {
      const res = await movieApi.importTmdbImages(movieId, { tmdbId: form.tmdbId, selections: pendingMediaSelections });
      toast.success(`Imported ${res.result.importedCount} TMDB image(s).`);
      setMovieImages(res.result.images);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Some TMDB images could not be imported.");
    }
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    const { ok, msg } = validate();
    if (!ok) {
      setError(msg ?? "Please review the form.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const [{ ids: resolvedCompanyIds, resolved: resolvedCompanies }, resolvedCast] = await Promise.all([
        resolveCompanyIds(),
        resolveCastPersonIds(),
      ]);
      setForm((p) => ({
        ...p,
        selectedCompanies: resolvedCompanies,
        cast: p.cast.map((c, i) => ({ ...c, personId: resolvedCast[i]?.personId ?? c.personId })),
      }));

      const payload = buildPayload(resolvedCompanyIds, resolvedCast);
      if (editMovieId) {
        await movieApi.updateMovieV2(editMovieId, payload);
        await importPendingMediaInto(editMovieId);
        toast.success("Movie updated.");
        navigate("/admin/movies");
      } else {
        const created = await movieApi.createMovieV2(payload);
        setLocalEditId(created.result.movieId);
        await importPendingMediaInto(created.result.movieId);
        toast.success(`"${created.result.originalTitle}" created as DRAFT.`);
        navigate("/admin/movies");
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Save failed, please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const applyTmdb = async (item: TmdbSearchItem, prefetchedDetails?: TmdbMovieDetails) => {
    setCatalogApplying(true);
    setError("");
    try {
      const details = prefetchedDetails ?? (await movieApi.tmdbDetails(item.tmdbId)).result;
      const vietnamese = details.translations?.find((translation) => translation.languageCode === "vi");
      const english = details.translations?.find((translation) => translation.languageCode === "en");
      const resolvedGenreIds = details.genres
        ? details.genres.flatMap((genre) => genre.localGenreId != null ? [genre.localGenreId] : [])
        : (details.genreIds ?? []);
      const unresolvedGenres = details.genres?.filter((genre) => genre.localGenreId == null) ?? [];

      // Issue #151: all TMDB-listed companies replace the form's selection, not just the
      // first one. Ones never imported locally (localCompanyId == null) are created on submit
      // via resolveCompanyIds(), same pattern the old single-company flow used.
      const tmdbCompanies: SelectedCompany[] | null = details.companies?.map((c) => ({
        companyId: c.localCompanyId ?? null, name: c.name, country: c.country, logoUrl: c.logoUrl,
      })) ?? null;

      setForm((p) => ({
        ...p,
        originalTitle: details.originalTitle || item.originalTitle || item.title || p.originalTitle,
        originalLanguage: details.originalLanguage || p.originalLanguage,
        durationMinutes: details.durationMinutes || p.durationMinutes,
        releaseDate: details.releaseDate || item.releaseDate || p.releaseDate,
        country: details.country || p.country,
        selectedCompanies: tmdbCompanies ?? p.selectedCompanies,
        // TMDB-FIX-05: thumbnailUrl is a genuinely smaller CDN derivative computed server-side,
        // never a straight copy of posterUrl.
        posterUrl: details.posterUrl || item.posterUrl || p.posterUrl,
        thumbnailUrl: details.thumbnailUrl || details.posterUrl || item.posterUrl || p.thumbnailUrl,
        trailerUrl: details.trailerUrl || p.trailerUrl,
        tmdbId: details.tmdbId,
        imdbId: details.imdbId,
        genreIds: resolvedGenreIds.length ? resolvedGenreIds : p.genreIds,
        ageRatingId: details.ageRatingId ?? p.ageRatingId,
        vi_title: vietnamese?.title ?? p.vi_title,
        vi_synopsis: vietnamese?.synopsis ?? p.vi_synopsis,
        vi_tagline: vietnamese?.tagline ?? p.vi_tagline,
        en_title: english?.title ?? details.originalTitle ?? p.en_title,
        en_synopsis: english?.synopsis ?? details.overview ?? p.en_synopsis,
        // `[Backend] Add tagline field to Movie and MovieTranslation entities`: the "en"
        // translation entry already falls back to details.tagline server-side (same pattern
        // as originalTitle/overview above), so no separate details.tagline reference needed.
        en_tagline: english?.tagline ?? p.en_tagline,
        cast: (details.cast ?? []).map((member, index) => ({
          _key: `${member.tmdbId}-${member.roleType}-${index}`,
          personId: member.localPersonId ?? null,
          tmdbPersonId: member.tmdbId,
          fullName: member.fullName,
          photoUrl: member.photoUrl,
          roleType: member.roleType === "DIRECTOR" ? "DIRECTOR" : "ACTOR",
          characterName: member.characterName ?? "",
        })),
      }));
      setTmdbMedia(details.media ?? null);
      setPendingMediaSelections([]);

      // `[Frontend] Show TMDB import warnings/mappings/media preview`: surface the review
      // instead of silently applying + one toast. Genre-mapping resolution resets per apply -
      // a fresh TMDB result means a fresh set of decisions to make.
      setTmdbWarnings(classifyWarnings(details.warnings));
      setTmdbUnmappedGenres(unresolvedGenres);
      setGenreResolutions({});
      setIgnoreReasonDraft({});
      setTmdbTrailer(details.trailerUrl ? { url: details.trailerUrl, videoType: details.trailerVideoType } : null);
      setTmdbUnverified({
        releaseDate: !!(details.releaseDate || item.releaseDate),
        ageRatingId: details.ageRatingId != null,
      });

    } catch (e: any) {
      setError(describeTmdbFetchError(e));
    } finally {
      setCatalogApplying(false);
    }
  };

  useEffect(() => {
    if (editMovieId) return;
    const tmdbId = Number(searchParams.get("tmdbId"));
    if (!Number.isFinite(tmdbId) || tmdbId <= 0 || catalogImportStarted.current === tmdbId) return;

    const navigationState = location.state as {
      tmdbItem?: TmdbSearchItem;
      tmdbDetails?: TmdbMovieDetails;
    } | null;
    const stateItem = navigationState?.tmdbItem;
    const item: TmdbSearchItem = stateItem?.tmdbId === tmdbId
      ? stateItem
      : { tmdbId, title: `TMDB #${tmdbId}`, originalTitle: `TMDB #${tmdbId}` };
    const details = navigationState?.tmdbDetails?.tmdbId === tmdbId
      ? navigationState.tmdbDetails
      : undefined;

    catalogImportStarted.current = tmdbId;
    void applyTmdb(item, details);
  }, [editMovieId, location.state, searchParams]);

  // ── TMDB genre-mapping resolution (map existing / create new / ignore with reason) ────
  // Each unmapped TMDB genre blocks Save until resolved one of these three ways - see
  // hasBlockingTmdbIssues below and its use in validate().

  const resolveGenreMapExisting = (tmdbGenreId: number, localGenreId: number) => {
    setGenreResolutions((prev) => ({ ...prev, [tmdbGenreId]: { action: "mapped" } }));
    setForm((p) => ({
      ...p,
      genreIds: p.genreIds.includes(localGenreId) ? p.genreIds : [...p.genreIds, localGenreId],
    }));
  };

  const resolveGenreCreateNew = async (tmdbGenreId: number, name: string) => {
    setCreatingGenreId(tmdbGenreId);
    try {
      const created = await movieApi.createGenre({ genreName: name });
      setGenres((prev) => [...prev, created.result]);
      setGenreResolutions((prev) => ({ ...prev, [tmdbGenreId]: { action: "created" } }));
      setForm((p) => ({ ...p, genreIds: [...p.genreIds, created.result.genreId] }));
      toast.success(`Genre "${name}" created.`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to create genre.");
    } finally {
      setCreatingGenreId(null);
    }
  };

  const resolveGenreIgnore = (tmdbGenreId: number) => {
    const reason = (ignoreReasonDraft[tmdbGenreId] ?? "").trim();
    setGenreResolutions((prev) => ({ ...prev, [tmdbGenreId]: { action: "ignored", reason: reason || "No reason given" } }));
  };

  const unresolvedTmdbGenres = tmdbUnmappedGenres.filter((g) => !genreResolutions[g.tmdbGenreId]);
  const hasBlockingTmdbIssues = unresolvedTmdbGenres.length > 0;
  const groupedTmdbWarnings = groupWarnings(tmdbWarnings);

  const handleDrop = (toIdx: number) => {
    const from = dragIdx.current;
    if (from < 0 || from === toIdx) return;
    const next = [...form.cast];
    const [item] = next.splice(from, 1);
    next.splice(toIdx, 0, item);
    set("cast", next);
    dragIdx.current = -1;
  };

  const addCastMember = (p: PersonResponse) => {
    if (form.cast.find((c) => c.personId === p.personId)) return;
    set("cast", [
      ...form.cast,
      {
        _key: `${p.personId}-${Date.now()}`,
        personId: p.personId,
        fullName: p.fullName,
        photoUrl: p.photoUrl,
        roleType: "ACTOR",
        characterName: "",
      },
    ]);
    setPersonQ("");
    setPersonResults([]);
    setShowPersonDrop(false);
  };

  const removeCast = (idx: number) => {
    const next = [...form.cast];
    next.splice(idx, 1);
    set("cast", next);
  };

  const updateCast = <K extends keyof CastRow>(idx: number, key: K, val: CastRow[K]) => {
    const next = [...form.cast];
    next[idx] = { ...next[idx], [key]: val };
    set("cast", next);
  };

  const handleImgUpload = async (field: "posterUrl" | "thumbnailUrl", file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be JPG/PNG/WebP, max 5MB.");
      return;
    }
    setUploadError("");
    setUploadingImg(field);
    try {
      const r = await movieApi.uploadImage(file);
      const url = r.result?.secureUrl || r.result?.url;
      if (url) set(field, url);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploadingImg(null);
    }
  };

  const reqBorder = (val: string | number | null | undefined) =>
    submitted && (!val || val === 0 || (typeof val === "string" && !val.trim()))
      ? "1px solid #f87171"
      : IS.border as string;

  if (loadingMovie || catalogApplying) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(editMovieId ? "/admin/movies" : "/admin/movies/new")}
            className="w-9 h-9 rounded-lg border flex items-center justify-center hover:opacity-80 transition-colors flex-shrink-0"
            style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Film size={17} className="text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-main)" }}>
                {editMovieId ? "Edit Movie" : "Add New Movie"}
              </h1>
              {currentContentStatus && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ background: MOVIE_CONTENT_STATUS_META[currentContentStatus].text }}
                >
                  {MOVIE_CONTENT_STATUS_META[currentContentStatus].label}
                </span>
              )}
            </div>
            <p style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>
              {editMovieId ? "Update movie information" : "Create a new movie as DRAFT"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(editMovieId ? "/admin/movies" : "/admin/movies/new")}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
            style={{ fontSize: "14px", fontWeight: 500 }}
          >
            {submitting ? "Saving…" : editMovieId ? "Save Changes" : "Add Movie"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-rose-500" />
          <p className="text-xs text-rose-600 leading-relaxed">{error}</p>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ═══ LEFT COLUMN: form sections ═══ */}
        <div className="space-y-5">

          {/* Basic Info */}
          <section className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <p style={SL}>Basic Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label style={FL}>Original Title <span className="text-rose-500">*</span></label>
                <input
                  type="text" placeholder="e.g. Parasite"
                  value={form.originalTitle} onChange={(e) => set("originalTitle", e.target.value)}
                  className={IC} style={{ ...IS, border: reqBorder(form.originalTitle) }}
                />
              </div>
              <div>
                <label style={FL}>Original Language <span className="text-rose-500">*</span></label>
                <select
                  value={form.originalLanguage} onChange={(e) => set("originalLanguage", e.target.value)}
                  className={IC + " cursor-pointer"} style={IS}
                >
                  {LANG_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={FL}>Duration (minutes) <span className="text-rose-500">*</span></label>
                <input
                  type="number" min="1" value={form.durationMinutes}
                  onChange={(e) => set("durationMinutes", parseInt(e.target.value) || 0)}
                  className={IC} style={{ ...IS, border: reqBorder(form.durationMinutes) }}
                />
                {form.durationMinutes > 0 && (
                  <span style={{ fontSize: "11px", color: "var(--text-sub)", display: "block", marginTop: "4px" }}>
                    {fmtDuration(form.durationMinutes)}
                  </span>
                )}
              </div>
              <div>
                <label style={FL}>
                  Release Date
                  {tmdbUnverified.releaseDate && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded" style={{ fontSize: "9.5px", fontWeight: 700, background: "#e0f2fe", color: "#0369a1" }}>
                      TMDB · UNVERIFIED
                    </span>
                  )}
                </label>
                <input
                  type="date" value={form.releaseDate}
                  onChange={(e) => {
                    set("releaseDate", e.target.value);
                    setTmdbUnverified((p) => ({ ...p, releaseDate: false }));
                  }}
                  className={IC} style={IS}
                />
              </div>
              <div>
                <label style={FL}>End Date <span style={{ fontWeight: 400, color: "var(--text-sub)" }}>(auto-ends showing)</span></label>
                <input
                  type="date" value={form.endDate} min={form.releaseDate || undefined}
                  onChange={(e) => set("endDate", e.target.value)} className={IC} style={IS}
                />
              </div>
              <div>
                <label style={FL}>Country</label>
                <input type="text" placeholder="e.g. South Korea" value={form.country} onChange={(e) => set("country", e.target.value)} className={IC} style={IS} />
              </div>
              <div className="col-span-2">
                <label style={FL}>
                  Age Rating
                  {tmdbUnverified.ageRatingId && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded" style={{ fontSize: "9.5px", fontWeight: 700, background: "#e0f2fe", color: "#0369a1" }}>
                      TMDB · UNVERIFIED
                    </span>
                  )}
                </label>
                <select
                  value={form.ageRatingId ?? ""}
                  onChange={(e) => {
                    set("ageRatingId", e.target.value ? Number(e.target.value) : null);
                    setTmdbUnverified((p) => ({ ...p, ageRatingId: false }));
                  }}
                  className={IC + " cursor-pointer"} style={IS}
                >
                  <option value="">— None —</option>
                  {ageRatings.map((ar) => <option key={ar.ratingId} value={ar.ratingId}>{ar.ratingCode} — {ar.description}</option>)}
                </select>
              </div>
            </div>

            <div ref={companyRef} className="relative mt-3">
              <label style={FL}>Production Companies</label>
              {form.selectedCompanies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.selectedCompanies.map((c, i) => (
                    <span
                      key={`${c.companyId ?? "pending"}-${c.name}-${i}`}
                      className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full border"
                      style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", fontSize: "12.5px", color: "var(--text-main)" }}
                    >
                      {c.name}
                      {c.companyId == null && (
                        <span style={{ fontSize: "10px", color: "var(--text-sub)" }}>(new)</span>
                      )}
                      <button
                        type="button"
                        onClick={() => set("selectedCompanies", form.selectedCompanies.filter((_, j) => j !== i))}
                        className="rounded-full hover:bg-red-50 hover:text-red-600 p-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  type="text" placeholder="Type company name to search and add…" value={companyQ}
                  onFocus={() => { if (companyQ) setShowCompanyDrop(true); }}
                  onChange={(e) => { setCompanyQ(e.target.value); setShowCompanyDrop(true); }}
                  className={IC} style={IS}
                />
                {companyLoading && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
                )}
              </div>
              {showCompanyDrop && companies.length > 0 && (
                <div className="absolute z-20 w-full mt-1 rounded-xl border shadow-lg overflow-hidden" style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}>
                  {companies
                    .filter((c) => !form.selectedCompanies.some((sc) => sc.companyId === c.companyId))
                    .map((c) => (
                    <button
                      key={c.companyId} type="button"
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                      onClick={() => {
                        set("selectedCompanies", [...form.selectedCompanies,
                          { companyId: c.companyId, name: c.name, country: c.country, logoUrl: c.logoUrl }]);
                        setCompanyQ("");
                        setShowCompanyDrop(false);
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>{c.name}</span>
                      {c.country && <span style={{ fontSize: "12px", color: "var(--text-sub)", marginLeft: "8px" }}>{c.country}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3">
              <label style={FL}>Trailer URL</label>
              <input type="text" placeholder="https://www.youtube.com/watch?v=…" value={form.trailerUrl} onChange={(e) => set("trailerUrl", e.target.value)} className={IC} style={IS} />
            </div>
          </section>

          {/* Genres & Formats */}
          <section className="rounded-2xl border p-5 space-y-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <div>
              <p style={SL}>Genres <span className="text-rose-500">*</span></p>
              {genres.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Loading…</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {genres.map((g) => {
                    const sel = form.genreIds.includes(g.genreId);
                    return (
                      <button
                        key={g.genreId} type="button"
                        onClick={() => set("genreIds", sel ? form.genreIds.filter((id) => id !== g.genreId) : [...form.genreIds, g.genreId])}
                        className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                        style={{ background: sel ? "#2563eb" : "transparent", color: sel ? "#fff" : "var(--text-sub)", borderColor: sel ? "#2563eb" : "var(--border-color)" }}
                      >
                        {g.genreName}
                      </button>
                    );
                  })}
                </div>
              )}
              {submitted && form.genreIds.length === 0 && <p className="mt-2 text-xs text-rose-500">Select at least 1 genre.</p>}
            </div>

            <div>
              <p style={SL}>Screening Formats <span className="text-rose-500">*</span></p>
              {formats.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Loading…</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {formats.map((f) => {
                    const sel = form.formatIds.includes(f.formatId);
                    return (
                      <button
                        key={f.formatId} type="button"
                        onClick={() => set("formatIds", sel ? form.formatIds.filter((id) => id !== f.formatId) : [...form.formatIds, f.formatId])}
                        className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                        style={{ background: sel ? "#2563eb" : "transparent", color: sel ? "#fff" : "var(--text-sub)", borderColor: sel ? "#2563eb" : "var(--border-color)" }}
                      >
                        {f.formatCode}{f.formatName && f.formatName !== f.formatCode && ` — ${f.formatName}`}
                        {Number(f.surcharge) > 0 && <span className="ml-1 opacity-70">(+{Number(f.surcharge).toLocaleString()})</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {submitted && form.formatIds.length === 0 && <p className="mt-2 text-xs text-rose-500">Select at least 1 screening format.</p>}
            </div>
          </section>

          {/* Languages */}
          <section className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <p style={SL}>Multilingual Titles & Descriptions</p>
            <div className="inline-flex gap-1 p-1 rounded-lg mb-3" style={{ background: "var(--bg-main)" }}>
              {(["vi", "en"] as const).map((lang) => (
                <button
                  key={lang} type="button" onClick={() => setLangTab(lang)}
                  className="px-4 py-1.5 rounded-md transition-colors"
                  style={{
                    fontSize: "13px", fontWeight: langTab === lang ? 600 : 400,
                    background: langTab === lang ? "var(--bg-card)" : "transparent",
                    color: langTab === lang ? "var(--text-main)" : "var(--text-sub)",
                    boxShadow: langTab === lang ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {lang === "vi" ? "🇻🇳 Vietnamese" : "🇬🇧 English"}
                </button>
              ))}
            </div>

            {langTab === "vi" && (
              <div className="space-y-3">
                <div>
                  <label style={FL}>Movie Title (Vietnamese)</label>
                  <input type="text" placeholder="e.g. Ký Sinh Trùng" value={form.vi_title} onChange={(e) => set("vi_title", e.target.value)} className={IC} style={IS} />
                </div>
                <div>
                  <label style={FL}>Tagline (Vietnamese) <span style={{ fontWeight: 400, color: "var(--text-sub)" }}>— short catchphrase, not a synopsis</span></label>
                  <input type="text" placeholder="e.g. Một gia đình, hai thế giới." value={form.vi_tagline} onChange={(e) => set("vi_tagline", e.target.value)} className={IC} style={IS} />
                </div>
                <div>
                  <label style={FL}>Synopsis (Vietnamese)</label>
                  <textarea rows={5} placeholder="Brief synopsis in Vietnamese…" value={form.vi_synopsis} onChange={(e) => set("vi_synopsis", e.target.value)} className={IC + " resize-none"} style={IS} />
                </div>
              </div>
            )}
            {langTab === "en" && (
              <div className="space-y-3">
                <div>
                  <label style={FL}>Movie Title (English)</label>
                  <input type="text" placeholder="e.g. Parasite" value={form.en_title} onChange={(e) => set("en_title", e.target.value)} className={IC} style={IS} />
                </div>
                <div>
                  <label style={FL}>Tagline (English) <span style={{ fontWeight: 400, color: "var(--text-sub)" }}>— short catchphrase, not a synopsis</span></label>
                  <input type="text" placeholder="e.g. Fear is a choice." value={form.en_tagline} onChange={(e) => set("en_tagline", e.target.value)} className={IC} style={IS} />
                </div>
                <div>
                  <label style={FL}>Synopsis (English)</label>
                  <textarea rows={5} placeholder="Brief synopsis in English…" value={form.en_synopsis} onChange={(e) => set("en_synopsis", e.target.value)} className={IC + " resize-none"} style={IS} />
                </div>
              </div>
            )}
          </section>

          {/* Cast & Crew */}
          <section className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <p style={SL}>Cast & Crew</p>
            <div ref={personRef} className="relative mb-3">
              <label style={FL}>Search person</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
                <input
                  type="text" placeholder="Actor or director name…" value={personQ}
                  onChange={(e) => { setPersonQ(e.target.value); setShowPersonDrop(true); }}
                  onFocus={() => { if (personQ) setShowPersonDrop(true); }}
                  className={IC + " pl-9"} style={IS}
                />
                {personLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />}
              </div>
              {showPersonDrop && personResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 rounded-xl border shadow-lg overflow-hidden" style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}>
                  {personResults.map((p) => (
                    <button key={p.personId} type="button" className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors" onClick={() => addCastMember(p)}>
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.fullName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center" style={{ fontSize: "12px", color: "#6b7280" }}>{p.fullName[0]}</div>
                      )}
                      <div className="text-left">
                        <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>{p.fullName}</p>
                        {p.nationality && <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>{p.nationality}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {form.cast.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed" style={{ borderColor: "var(--border-color)" }}>
                <Users size={26} style={{ color: "var(--text-sub)", marginBottom: "8px" }} />
                <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>No cast added yet. Use the search above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p style={{ fontSize: "11px", color: "var(--text-sub)", marginBottom: "4px" }}>Drag ⠿ to reorder billing</p>
                {form.cast.map((c, idx) => (
                  <div
                    key={c._key} draggable
                    onDragStart={() => { dragIdx.current = idx; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(idx)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                    style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", cursor: "grab" }}
                  >
                    <GripVertical size={16} style={{ color: "var(--text-sub)", flexShrink: 0 }} />
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0" style={{ fontSize: "11px", fontWeight: 600 }}>{idx + 1}</span>
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt={c.fullName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center" style={{ fontSize: "12px", color: "#6b7280" }}>{c.fullName[0]}</div>
                    )}
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)", minWidth: "90px", flexShrink: 0 }}>{c.fullName}</span>
                    <select
                      value={c.roleType} onChange={(e) => updateCast(idx, "roleType", e.target.value as "ACTOR" | "DIRECTOR")}
                      className="px-2 py-1 rounded-lg border text-xs cursor-pointer flex-shrink-0"
                      style={{ background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
                    >
                      <option value="ACTOR">Actor</option>
                      <option value="DIRECTOR">Director</option>
                    </select>
                    <input
                      type="text" placeholder="Character name (optional)" value={c.characterName}
                      onChange={(e) => updateCast(idx, "characterName", e.target.value)}
                      className="flex-1 px-2 py-1 rounded-lg border text-xs outline-none focus:border-blue-400 min-w-0"
                      style={{ background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
                    />
                    <button type="button" onClick={() => removeCast(idx)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors flex-shrink-0" style={{ color: "var(--text-sub)" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ═══ RIGHT COLUMN: poster preview, TMDB import, gallery ═══ */}
        <div className="space-y-5 lg:sticky lg:top-6">

          {/* Poster / thumbnail preview */}
          <section className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <p style={SL}>Poster</p>
            {form.posterUrl ? (
              <div className="relative rounded-xl border overflow-hidden mb-3" style={{ borderColor: "var(--border-color)" }}>
                <img src={form.posterUrl} alt="Poster" className="w-full object-cover" style={{ aspectRatio: "2 / 3" }} />
                <button type="button" onClick={() => set("posterUrl", "")} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed cursor-pointer hover:border-blue-400 transition-colors mb-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", aspectRatio: "2 / 3" }}>
                {uploadingImg === "posterUrl" ? (
                  <><Loader2 size={22} className="animate-spin text-blue-500" /><span style={{ fontSize: "12px", color: "var(--text-sub)" }}>Uploading…</span></>
                ) : (
                  <><Upload size={22} className="text-blue-500" /><span style={{ fontSize: "12.5px", fontWeight: 500, color: "var(--text-main)" }}>Click to upload</span><span style={{ fontSize: "11px", color: "var(--text-sub)" }}>JPG · PNG · WebP · ≤ 5MB</span></>
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingImg === "posterUrl"}
                  onChange={(e) => { handleImgUpload("posterUrl", e.target.files?.[0]); e.currentTarget.value = ""; }} />
              </label>
            )}
            <input type="text" placeholder="or paste poster URL…" value={form.posterUrl} onChange={(e) => set("posterUrl", e.target.value)} className={IC} style={{ ...IS, fontSize: "12px" }} />
            {uploadError && <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{uploadError}</p>}

            {form.thumbnailUrl && form.thumbnailUrl !== form.posterUrl && (
              <div className="mt-3 flex items-center gap-2">
                <img src={form.thumbnailUrl} alt="Thumbnail" className="w-12 h-16 rounded-lg object-cover border" style={{ borderColor: "var(--border-color)" }} />
                <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>Thumbnail derivative (auto-generated from TMDB)</p>
              </div>
            )}
          </section>

          {/* Source provenance remains visible after the full-width catalog populates this draft. */}
          {form.tmdbId && <section className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <p style={SL}>Catalog source</p>

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 mb-3" style={{ width: "fit-content" }}>
              <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0"><Check size={10} className="text-white" /></div>
              <span style={{ fontSize: "12px", color: "#065f46", fontWeight: 500 }}>TMDB</span>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>·</span>
              <a href={`https://www.themoviedb.org/movie/${form.tmdbId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#059669", fontWeight: 500, textDecoration: "none" }}>#{form.tmdbId}</a>
            </div>
          </section>}

          {/* TMDB Import Review - grouped/severity-tagged warnings, genre-mapping resolution
              (map existing / create new / ignore with reason), and the suggested trailer.
              Genre resolution below gates Save (see hasBlockingTmdbIssues / validate()).
              There is no "re-sync" action here - the backend has no resync capability yet
              (disclosed out-of-scope, same as the multi-company and trailer-ingestion MRs). */}
          {form.tmdbId && (tmdbWarnings.length > 0 || tmdbUnmappedGenres.length > 0 || tmdbTrailer) && (
            <section
              className="rounded-2xl border p-5 space-y-4"
              style={{ background: "var(--bg-card)", borderColor: hasBlockingTmdbIssues ? "#f87171" : "var(--border-color)" }}
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className={hasBlockingTmdbIssues ? "text-red-500" : "text-amber-500"} />
                <p style={{ ...SL, marginBottom: 0 }}>TMDB Import Review</p>
              </div>

              {WARNING_GROUP_ORDER.filter((group) => group !== "genre-mapping").map((group) => {
                const items = groupedTmdbWarnings[group];
                if (!items?.length) return null;
                return (
                  <div key={group}>
                    <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", marginBottom: "4px" }}>
                      {WARNING_GROUP_LABELS[group]}
                    </p>
                    <ul className="space-y-1">
                      {items.map((w, i) => (
                        <li key={i} className="flex items-start gap-1.5" style={{ fontSize: "12px" }}>
                          <span
                            className="px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{
                              fontSize: "9.5px", fontWeight: 700, textTransform: "uppercase", marginTop: "1px",
                              background: w.severity === "BLOCKING" ? "#fee2e2" : w.severity === "WARNING" ? "#fef3c7" : "#e0f2fe",
                              color: w.severity === "BLOCKING" ? "#b91c1c" : w.severity === "WARNING" ? "#92400e" : "#0369a1",
                            }}
                          >
                            {w.severity}
                          </span>
                          <span style={{ color: "var(--text-main)" }}>{w.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {tmdbUnmappedGenres.length > 0 && (
                <div>
                  <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", marginBottom: "6px" }}>
                    {WARNING_GROUP_LABELS["genre-mapping"]} ({unresolvedTmdbGenres.length} unresolved)
                  </p>
                  <div className="space-y-2">
                    {tmdbUnmappedGenres.map((g) => {
                      const resolution = genreResolutions[g.tmdbGenreId];
                      return (
                        <div
                          key={g.tmdbGenreId}
                          className="p-2.5 rounded-lg border"
                          style={{ borderColor: resolution ? "var(--border-color)" : "#fca5a5", background: "var(--bg-main)" }}
                        >
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <span style={{ fontSize: "12.5px", fontWeight: 500, color: "var(--text-main)" }}>
                              {g.name} <span style={{ color: "var(--text-sub)", fontWeight: 400 }}>(TMDB genre, unmapped)</span>
                            </span>
                            {resolution && (
                              <span style={{ fontSize: "11px", color: "#059669", flexShrink: 0 }}>
                                {resolution.action === "mapped" && "✓ Mapped"}
                                {resolution.action === "created" && "✓ Created"}
                                {resolution.action === "ignored" && `Ignored — ${resolution.reason}`}
                              </span>
                            )}
                          </div>
                          {!resolution && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <select
                                defaultValue=""
                                onChange={(e) => { if (e.target.value) resolveGenreMapExisting(g.tmdbGenreId, Number(e.target.value)); }}
                                className="px-2 py-1 rounded border cursor-pointer" style={{ ...IS, fontSize: "12px" }}
                              >
                                <option value="">Map to existing…</option>
                                {genres.map((lg) => <option key={lg.genreId} value={lg.genreId}>{lg.genreName}</option>)}
                              </select>
                              {isAdmin && (
                                <button
                                  type="button" disabled={creatingGenreId === g.tmdbGenreId}
                                  onClick={() => resolveGenreCreateNew(g.tmdbGenreId, g.name)}
                                  className="px-2 py-1 rounded border hover:bg-blue-50 disabled:opacity-50"
                                  style={{ fontSize: "12px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
                                >
                                  {creatingGenreId === g.tmdbGenreId ? "Creating…" : "Create new"}
                                </button>
                              )}
                              <input
                                type="text" placeholder="Ignore reason…"
                                value={ignoreReasonDraft[g.tmdbGenreId] ?? ""}
                                onChange={(e) => setIgnoreReasonDraft((prev) => ({ ...prev, [g.tmdbGenreId]: e.target.value }))}
                                className="px-2 py-1 rounded border flex-1 min-w-[110px]" style={{ ...IS, fontSize: "12px" }}
                              />
                              <button
                                type="button" onClick={() => resolveGenreIgnore(g.tmdbGenreId)}
                                className="px-2 py-1 rounded border hover:bg-red-50"
                                style={{ fontSize: "12px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
                              >
                                Ignore
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {tmdbTrailer && (
                <div>
                  <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", marginBottom: "4px" }}>Suggested trailer</p>
                  <a
                    href={tmdbTrailer.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "12px", color: "#2563eb", wordBreak: "break-all" }}
                  >
                    {tmdbTrailer.url}
                  </a>
                  {tmdbTrailer.videoType === "TEASER" && (
                    <span style={{ fontSize: "10.5px", color: "var(--text-sub)", marginLeft: "6px" }}>(teaser fallback - no trailer found)</span>
                  )}
                  <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "2px" }}>
                    Applied to the Trailer URL field above — edit it there to use a different one.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* TMDB media picker - only once a search result has been applied */}
          {tmdbMedia && form.tmdbId && (
            <TmdbMediaPicker
              tmdbId={form.tmdbId}
              media={tmdbMedia}
              movieId={activeMovieId}
              onPendingSelectionChange={setPendingMediaSelections}
              onImported={() => {
                if (activeMovieId) movieApi.getMovieImages(activeMovieId).then((r) => setMovieImages(r.result ?? [])).catch(() => {});
              }}
            />
          )}

          {/* Gallery */}
          <section className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <p style={SL}>Photo Gallery</p>
            {!activeMovieId ? (
              <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed" style={{ borderColor: "var(--border-color)" }}>
                <Images size={26} style={{ color: "var(--text-sub)", marginBottom: "8px" }} />
                <p style={{ fontSize: "12.5px", color: "var(--text-sub)", textAlign: "center" }}>Save the movie first to add gallery images.</p>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-xl border space-y-2.5 mb-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                  <input type="text" placeholder="Image URL…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={IC} style={{ ...IS, fontSize: "12.5px" }} />
                  <div className="flex gap-2">
                    <select
                      value={imageType} onChange={(e) => setImageType(e.target.value as MovieImageRequest["imageType"])}
                      className="flex-1 px-2.5 py-2 rounded-lg border text-xs cursor-pointer"
                      style={{ background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
                    >
                      <option value="POSTER">Poster</option>
                      <option value="BACKDROP">Backdrop</option>
                      <option value="STILL">Still</option>
                      <option value="PROMOTIONAL">Promotional</option>
                    </select>
                    <button
                      type="button" disabled={!imageUrl.trim() || addingImage}
                      onClick={async () => {
                        if (!imageUrl.trim() || !activeMovieId) return;
                        setAddingImage(true);
                        try {
                          const r = await movieApi.addMovieImage(activeMovieId, { imageUrl: imageUrl.trim(), imageType, caption: imageCaption.trim() || undefined, displayOrder: movieImages.length });
                          setMovieImages((prev) => [...prev, r.result]);
                          setImageUrl("");
                          setImageCaption("");
                        } catch (e: any) {
                          toast.error(e?.response?.data?.message ?? "Failed to add image.");
                        } finally {
                          setAddingImage(false);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex-shrink-0"
                      style={{ fontSize: "12.5px" }}
                    >
                      {addingImage ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      Add
                    </button>
                  </div>
                </div>

                {movieImages.length === 0 ? (
                  <p className="text-center py-6" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>No images yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {movieImages.map((img) => (
                      <div key={img.imageId} className="relative rounded-lg overflow-hidden border" style={{ borderColor: "var(--border-color)" }}>
                        <img src={img.imageUrl} alt={img.caption ?? ""} className="w-full h-20 object-cover" />
                        <div className="absolute inset-x-0 bottom-0 px-1.5 py-1" style={{ background: "rgba(0,0,0,0.55)" }}>
                          <span className="px-1 py-0.5 rounded text-white" style={{ fontSize: "9px", background: "rgba(255,255,255,0.2)" }}>{img.imageType}</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!activeMovieId) return;
                            try {
                              await movieApi.deleteMovieImage(activeMovieId, img.imageId);
                              setMovieImages((prev) => prev.filter((i) => i.imageId !== img.imageId));
                            } catch (e: any) {
                              toast.error(e?.response?.data?.message ?? "Failed to delete image.");
                            }
                          }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
