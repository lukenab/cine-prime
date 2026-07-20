import {
  X, Film, Upload, Loader2, Search, GripVertical, Trash2,
  HelpCircle,
  AlertCircle, Check, Tag, Globe, Users, Images, ArrowLeft,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
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
  type MovieResponse,
  type MovieImageResponse,
  type MovieImageRequest,
  type MovieMediaPreview,
  type MovieImageType,
  type TmdbGenrePreview,
  type TmdbMovieDetails,
  type TmdbImportPayload,
  type ReadinessViolation,
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
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import MovieEditorWorkflow, {
  MOVIE_EDITOR_SECTION_META,
  movieEditorSectionDomId,
  type MovieEditorSectionDefinition,
} from "./movieEditor/MovieEditorWorkflow";
import {
  MovieEditorActionBar,
  type MovieEditorActionStatus,
  type MovieEditorOperation,
} from "./movieEditor/MovieEditorActionBar";
import { persistMovieDraft, saveDraftThenSubmit } from "./movieEditor/movieDraftActions";
import { buildMoviePayload } from "./movieEditor/buildMoviePayload";
import { MediaThumbnail } from "./movieEditor/MediaThumbnail";

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
type SelectedCompany = { companyId: number | null; name: string; country?: string; logoUrl?: string; tmdbId?: number };

type FormState = {
  originalTitle: string;
  originalLanguage: string;
  durationMinutes: number;
  releaseDate: string;
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

const editorFingerprint = (
  value: FormState,
  pendingMedia: { filePath: string; imageType: MovieImageType }[],
) => JSON.stringify({ form: value, pendingMedia });

function movieToForm(mv: MovieResponse): FormState {
  const vi = mv.translations?.find((t) => t.languageCode === "vi");
  const en = mv.translations?.find((t) => t.languageCode === "en");
  const originalIsVietnamese = mv.originalLanguage?.toLowerCase() === "vi";
  return {
    originalTitle: mv.originalTitle ?? "",
    originalLanguage: mv.originalLanguage ?? "en",
    durationMinutes: mv.durationMinutes ?? 120,
    releaseDate: mv.releaseDate ?? "",
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

type MediaAssetState = "imported" | "pending" | "manual" | "empty";

const MEDIA_ASSET_STATE_META: Record<MediaAssetState, { label: string; bg: string; color: string }> = {
  imported: { label: "Imported", bg: "rgba(16,185,129,0.12)", color: "#059669" },
  pending: { label: "Pending import", bg: "rgba(245,158,11,0.12)", color: "#d97706" },
  manual: { label: "Manual", bg: "rgba(107,114,128,0.12)", color: "#6b7280" },
  empty: { label: "Not selected", bg: "rgba(107,114,128,0.10)", color: "var(--text-sub)" },
};

/** `[Frontend] Consolidate movie assets into a dedicated Media section`: one consistent
 *  source/status readout shared by the Poster, Backdrop and Trailer groups, so an operator
 *  never has to guess whether an asset came from TMDB, was typed in manually, or is still
 *  waiting to be imported after Save. */
function MediaAssetBadges({ source, state }: { source?: string | null; state: MediaAssetState }) {
  const meta = MEDIA_ASSET_STATE_META[state];
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {source && (
        <span
          className="px-1.5 py-0.5 rounded"
          style={{ fontSize: "9.5px", fontWeight: 700, background: "rgba(37,99,235,0.10)", color: "#2563eb" }}
        >
          Source: {source}
        </span>
      )}
      <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "9.5px", fontWeight: 700, background: meta.bg, color: meta.color }}>
        {meta.label}
      </span>
    </div>
  );
}

/** Lightweight sanity check for the Trailer group's broken-link indicator - not a validator,
 *  just a hint that the URL doesn't look like a playable YouTube link before the operator saves. */
function isLikelyVideoUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/i.test(url.trim());
}

/**
 * Dedicated Create/Edit Movie page (replaces the old MovieModal). A movie's full editing
 * surface — TMDB import, poster/gallery previews, genre/format chips, bilingual titles,
 * cast reordering — genuinely needs more room than a centered modal: dropdowns were getting
 * clipped, the TMDB search was a modal stacked on top of the modal, and image previews were
 * squeezed into a 2-column grid. Create and edit now share a guided, single-owner form shell;
 * canonical sections are reordered visually without remounting their controlled field state.
 */
function ReadinessSummary({
  validationErrors,
  backendViolations,
  hasBlockingTmdbIssues
}: {
  validationErrors: Record<string, string>;
  backendViolations: ReadinessViolation[];
  hasBlockingTmdbIssues: boolean;
}) {
  const blockingCount = Object.keys(validationErrors).length + backendViolations.length + (hasBlockingTmdbIssues ? 1 : 0);
  
  if (blockingCount === 0) {
    return (
      <div className="rounded-lg p-2.5 px-3.5 border mb-3 flex items-center justify-between" style={{ background: "rgba(16,185,129,0.05)", borderColor: "rgba(16,185,129,0.2)" }}>
        <div className="flex items-center gap-2.5">
          <Check size={15} className="text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-700" style={{ fontSize: "12.5px", lineHeight: "1.2" }}>Ready for review</p>
            <p className="mt-0.5" style={{ fontSize: "11px", color: "var(--text-sub)", lineHeight: "1.2" }}>All required fields and checks are complete.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-3 px-4 border mb-3" style={{ background: "rgba(244,63,94,0.05)", borderColor: "rgba(244,63,94,0.2)" }}>
      <div className="flex items-center gap-2 text-rose-600 mb-2">
        <AlertCircle size={15} />
        <p className="font-medium" style={{ fontSize: "12.5px" }}>Readiness Blockers ({blockingCount})</p>
      </div>
      <ul className="space-y-1.5 text-rose-600/90 ml-6" style={{ fontSize: "11.5px", listStyleType: "disc" }}>
        {hasBlockingTmdbIssues && <li>Unresolved TMDB mappings</li>}
        {Object.entries(validationErrors).map(([field, msg]) => (
          <li key={field}>{msg}</li>
        ))}
        {backendViolations.map((v, i) => (
          <li key={i}>{v.rule.replace(/_/g, " ")} ({v.field})</li>
        ))}
      </ul>
      <p className="mt-2.5 ml-6" style={{ fontSize: "11px", color: "var(--text-sub)" }}>Please resolve these issues before submitting.</p>
    </div>
  );
}

export default function MovieEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAdmin, can } = useRole();
  const { movieId: movieIdParam } = useParams<{ movieId: string }>();
  const editMovieId = movieIdParam ? Number(movieIdParam) : null;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [loadingMovie, setLoadingMovie] = useState(!!editMovieId);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const currentContentStatus = currentStatus ? toMovieContentStatus(currentStatus) : null;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
    const [submitted, setSubmitted] = useState(false);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [backendViolations, setBackendViolations] = useState<ReadinessViolation[]>([]);

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
    Record<number, { action: "mapped" | "created" | "ignored"; localGenreId?: number; reason?: string }>
  >({});
  const [ignoreReasonDraft, setIgnoreReasonDraft] = useState<Record<number, string>>({});
  const [tmdbTrailer, setTmdbTrailer] = useState<{ url: string; videoType?: string } | null>(null);
  const [tmdbUnverified, setTmdbUnverified] = useState<{ releaseDate: boolean; ageRatingId: boolean }>({
    releaseDate: false,
    ageRatingId: false,
  });
  // TMDB gave no runtime for this title - the form still shows a value (its own default/prior
  // value) so admin can edit it, but the real POST /api/movies/tmdb/import call will fail with
  // MISSING_RUNTIME unless this value is sent as confirmedRuntimeMinutes.
  const [tmdbMissingRuntime, setTmdbMissingRuntime] = useState(false);

  // `[Frontend] Consolidate movie assets into a dedicated Media section`: provenance shown in
  // the Media section's Trailer group - mirrors Movie.trailerSource server-side (a manual edit
  // always wins over whatever TMDB suggested, same rule MovieService.updateMovie() enforces).
  const [trailerSource, setTrailerSource] = useState<"TMDB" | "MANUAL" | null>(null);

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
  const [showAllCast, setShowAllCast] = useState(false);
  const MAX_VISIBLE_CAST = 8;
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
  const [savedFingerprint, setSavedFingerprint] = useState(() => editorFingerprint(emptyForm, []));
  const [actionStatus, setActionStatus] = useState<MovieEditorActionStatus>("pristine");
  const [operation, setOperation] = useState<MovieEditorOperation>("idle");
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const operationGuard = useRef(false);
  const currentFingerprint = useMemo(
    () => editorFingerprint(form, pendingMediaSelections),
    [form, pendingMediaSelections],
  );
  const previousFingerprint = useRef(currentFingerprint);
  const isDirty = currentFingerprint !== savedFingerprint;

  useEffect(() => {
    if (previousFingerprint.current === currentFingerprint) return;
    previousFingerprint.current = currentFingerprint;
    if (operation === "idle" && (actionStatus === "save-error" || actionStatus === "submit-error" || actionStatus === "saved")) {
      setActionStatus("pristine");
    }
  }, [actionStatus, currentFingerprint, operation]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  // ── Load movie when editing ────────────────────────────────
  useEffect(() => {
    if (!editMovieId || editMovieId === localEditId) return;
    setLoadingMovie(true);
    movieApi
      .getMovieById(editMovieId)
      .then((res) => {
        const mv = res.result;
        const loadedForm = movieToForm(mv);
        setCurrentStatus(mv.status);
        setTrailerSource((mv.trailerSource as "TMDB" | "MANUAL" | undefined) ?? null);
        setForm(loadedForm);
        setPendingMediaSelections([]);
        previousFingerprint.current = editorFingerprint(loadedForm, []);
        setSavedFingerprint(editorFingerprint(loadedForm, []));
        setActionStatus("saved");
        if (mv.images?.length) setMovieImages(mv.images);
        else movieApi.getMovieImages(editMovieId).then((r) => setMovieImages(r.result ?? [])).catch(() => {});
      })
      .catch(() => setError("Failed to load movie."))
      .finally(() => setLoadingMovie(false));
  }, [editMovieId, localEditId]);

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

  // buildMoviePayload() is extracted to ./movieEditor/buildMoviePayload.ts (pure, unit-tested) -
  // notably, it never includes `endDate` at all (see that file's docstring).

  /** Creates a local ProductionCompany row for each TMDB-sourced pick that has no companyId
   *  yet, and returns the final list of resolved IDs. Existing companies pass straight through. */
  const resolveCompanyIds = async (): Promise<{ ids: number[]; resolved: SelectedCompany[] }> => {
    const resolved: SelectedCompany[] = [];
    for (const c of form.selectedCompanies) {
      if (c.companyId != null) {
        resolved.push(c);
        continue;
      }
      const created = await movieApi.createCompany({ name: c.name, country: c.country, logoUrl: c.logoUrl, tmdbCompanyId: c.tmdbId });
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

  const validateDraft = (): { ok: boolean; msg?: string } => {
    if (!form.originalTitle.trim()) return { ok: false, msg: "Please enter the original title." };
    if (!form.durationMinutes || form.durationMinutes < 1) return { ok: false, msg: "Duration must be ≥ 1 minute." };
    // A "Create new" genre resolution doesn't add a real genreId yet (it's created server-side
    // as PENDING_REVIEW at import time - see resolveGenreCreateNew), so it must still count here.
    if (form.genreIds.length === 0 && pendingCreatedGenreCount === 0) return { ok: false, msg: "Select at least 1 genre." };
    if (form.formatIds.length === 0) return { ok: false, msg: "Select at least 1 screening format." };
    return { ok: true };
  };

  const validateReviewReadiness = (): { ok: boolean; msg?: string } => {
    if (hasBlockingTmdbIssues) {
      return {
        ok: false,
        msg: `Resolve ${unresolvedTmdbGenres.length} unmapped TMDB genre(s) before submitting for review.`,
      };
    }
    return { ok: true };
  };

  const importPendingMediaInto = async (movieId: number): Promise<boolean> => {
    if (!form.tmdbId || pendingMediaSelections.length === 0) return true;
    try {
      const res = await movieApi.importTmdbImages(movieId, { tmdbId: form.tmdbId, selections: pendingMediaSelections });
      toast.success(`Imported ${res.result.importedCount} TMDB image(s).`);
      setMovieImages(res.result.images);
      setPendingMediaSelections([]);
      return true;
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Some TMDB images could not be imported.");
      return false;
    }
  };

  /** Converts the genre-resolution decisions already made in the TMDB Import Review panel
   *  into POST /api/movies/tmdb/import's request shape. */
  const buildTmdbImportPayload = (tmdbId: number): TmdbImportPayload => {
    const selectedGenreMappings: Record<number, number> = {};
    const createPendingGenres: number[] = [];
    const ignoredGenres: Record<number, string> = {};
    for (const [tmdbGenreIdStr, resolution] of Object.entries(genreResolutions)) {
      const tmdbGenreId = Number(tmdbGenreIdStr);
      if (resolution.action === "mapped" && resolution.localGenreId != null) {
        selectedGenreMappings[tmdbGenreId] = resolution.localGenreId;
      } else if (resolution.action === "created") {
        createPendingGenres.push(tmdbGenreId);
      } else if (resolution.action === "ignored") {
        ignoredGenres[tmdbGenreId] = resolution.reason ?? "No reason given";
      }
    }
    return {
      tmdbId,
      confirmedAgeRatingId: form.ageRatingId ?? undefined,
      confirmedRuntimeMinutes: tmdbMissingRuntime ? form.durationMinutes : undefined,
      selectedGenreMappings: Object.keys(selectedGenreMappings).length ? selectedGenreMappings : undefined,
      createPendingGenres: createPendingGenres.length ? createPendingGenres : undefined,
      ignoredGenres: Object.keys(ignoredGenres).length ? ignoredGenres : undefined,
    };
  };

  const persistCurrentDraft = async (): Promise<MovieResponse> => {
    setSubmitted(true);
    const { ok, msg } = validateDraft();
    if (!ok) throw new Error(msg ?? "Please review the form.");

    const [{ ids: resolvedCompanyIds, resolved: resolvedCompanies }, resolvedCast] = await Promise.all([
      resolveCompanyIds(),
      resolveCastPersonIds(),
    ]);
    const resolvedForm: FormState = {
      ...form,
      selectedCompanies: resolvedCompanies,
      cast: form.cast.map((castMember, index) => ({
        ...castMember,
        personId: resolvedCast[index]?.personId ?? castMember.personId,
      })),
    };
    const payload = buildMoviePayload(resolvedForm, resolvedCompanyIds, resolvedCast);
    const wasNewDraft = activeMovieId == null;
    // A brand-new movie that originated from a TMDB catalog pick goes through the real
    // POST /api/movies/tmdb/import first (idempotency-by-tmdbId/imdbId, genre resolution,
    // company/age-rating matching all run for real, not just client-side approximations of
    // them) - then any further local edits on top of the raw TMDB draft are applied with a
    // normal update. An existing movie (even one that has a tmdbId from a past import) always
    // just updates, same as any other edit.
    let savedMovie: MovieResponse;
    if (wasNewDraft && form.tmdbId) {
      const imported = await movieApi.tmdbImport(buildTmdbImportPayload(form.tmdbId));
      if (imported.result.warnings.length) {
        toast(`TMDB import: ${imported.result.warnings.join(", ")}`, { duration: 6000 });
      }
      // Genres attached by the import (mapped + newly-created PENDING_REVIEW ones) aren't known
      // client-side yet - merge them into the follow-up update's genreIds instead of overwriting
      // them, since UpdateMovieRequest.genreIds replaces the movie's whole genre list.
      const importedMovie = await movieApi.getMovieById(imported.result.movieId);
      const mergedGenreIds = Array.from(new Set([
        ...(importedMovie.result.genres?.map((g) => g.genreId) ?? []),
        ...(payload.genreIds ?? []),
      ]));
      savedMovie = (await movieApi.updateMovie(imported.result.movieId, { ...payload, genreIds: mergedGenreIds })).result;
    } else {
      savedMovie = await persistMovieDraft<CreateMovieRequest, MovieResponse>({
        movieId: activeMovieId,
        payload,
        createMovie: movieApi.createMovie,
        updateMovie: movieApi.updateMovie,
      });
    }

    setForm(resolvedForm);
    const mediaImported = await importPendingMediaInto(savedMovie.movieId);
    const persistedFingerprint = editorFingerprint(resolvedForm, []);
    previousFingerprint.current = editorFingerprint(
      resolvedForm,
      mediaImported ? [] : pendingMediaSelections,
    );
    setSavedFingerprint(persistedFingerprint);
    setCurrentStatus(savedMovie.status);

    if (wasNewDraft) {
      setLocalEditId(savedMovie.movieId);
      const sectionHash = window.location.hash;
      navigate(`/admin/movies/${savedMovie.movieId}/edit${sectionHash}`, { replace: true });
    }

    return savedMovie;
  };

  const errorMessage = (e: any, fallback: string) =>
    e?.response?.data?.message ?? e?.message ?? fallback;

  const handleSaveDraft = async () => {
    if (operationGuard.current) return;
    operationGuard.current = true;
    setSubmitting(true);
    setOperation("saving-draft");
    setError("");
    try {
      const savedMovie = await persistCurrentDraft();
      setActionStatus("saved");
      toast.success(`"${savedMovie.originalTitle}" saved as DRAFT.`);
    } catch (e: any) {
      const message = errorMessage(e, "Save failed, please try again.");
      setError(message);
      setActionStatus("save-error");
    } finally {
      setSubmitting(false);
      setOperation("idle");
      operationGuard.current = false;
    }
  };

  const handleSubmitForReview = async () => {
    if (operationGuard.current) return;
    operationGuard.current = true;
    let draftSaved = false;
    setSubmitting(true);
    setOperation("saving-before-submit");
    setError("");
    try {
      const reviewedMovie = await saveDraftThenSubmit<MovieResponse>({
        saveDraft: persistCurrentDraft,
        onDraftSaved: () => {
          draftSaved = true;
          setActionStatus("saved");
          setOperation("submitting");
        },
        submitForReview: (movieId) => {
          const readiness = validateReviewReadiness();
          if (!readiness.ok) throw new Error(readiness.msg ?? "Movie is not ready for review.");
          return movieApi.submitForReview(movieId);
        },
      });
      setCurrentStatus(reviewedMovie.status);
      setActionStatus("submitted");
      toast.success(`"${reviewedMovie.originalTitle}" submitted for review.`);
      // Once submitted, the form becomes read-only (canSaveDraft/canSubmitForReview both go
      // false via editableDraft) - nothing left to do here, so return to the list instead of
      // leaving the admin stranded on a now-frozen page. Toaster is mounted above the router
      // (App.tsx) so the success toast still shows after navigating.
      //
      // Deliberately hardcoded, not exitDestination: that const is computed once per render
      // from editMovieId/activeMovieId, and this closure is created (and captures it) before
      // the very first save of a brand-new draft has happened - saveDraftThenSubmit() above
      // updates activeMovieId as a side effect, but this already-running handler still holds
      // the stale pre-save value ("/admin/movies/new", the create-flow chooser) rather than
      // the fresh one. reviewedMovie having a real id here always means an actual saved movie
      // exists, so the list is always the correct destination, never the chooser.
      navigate("/admin/movies");
    } catch (e: any) {
      const message = errorMessage(
        e,
        draftSaved ? "Draft was saved, but submission failed." : "Could not save the draft before submission.",
      );
      setError(message);
      setActionStatus(draftSaved ? "submit-error" : "save-error");
    } finally {
      setSubmitting(false);
      setOperation("idle");
      operationGuard.current = false;
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
        companyId: c.localCompanyId ?? null, name: c.name, country: c.country, logoUrl: c.logoUrl, tmdbId: c.tmdbId,
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
      if (details.trailerUrl) setTrailerSource("TMDB");
      setTmdbUnverified({
        releaseDate: !!(details.releaseDate || item.releaseDate),
        ageRatingId: details.ageRatingId != null,
      });
      setTmdbMissingRuntime(!details.durationMinutes);

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
    setGenreResolutions((prev) => ({ ...prev, [tmdbGenreId]: { action: "mapped", localGenreId } }));
    setForm((p) => ({
      ...p,
      genreIds: p.genreIds.includes(localGenreId) ? p.genreIds : [...p.genreIds, localGenreId],
    }));
  };

  /** Records the decision only - the actual genre row is created server-side as PENDING_REVIEW
   *  by POST /api/movies/tmdb/import's createPendingGenres (see persistCurrentDraft()). This
   *  used to call POST /api/genres directly here, which created it as ACTIVE immediately -
   *  bypassing the genre-admin review the backend's readiness gate exists to enforce. */
  const resolveGenreCreateNew = (tmdbGenreId: number) => {
    setGenreResolutions((prev) => ({ ...prev, [tmdbGenreId]: { action: "created" } }));
  };

  const resolveGenreIgnore = (tmdbGenreId: number) => {
    const reason = (ignoreReasonDraft[tmdbGenreId] ?? "").trim();
    setGenreResolutions((prev) => ({ ...prev, [tmdbGenreId]: { action: "ignored", reason: reason || "No reason given" } }));
  };

  const unresolvedTmdbGenres = tmdbUnmappedGenres.filter((g) => !genreResolutions[g.tmdbGenreId]);
  const pendingCreatedGenreCount = Object.values(genreResolutions).filter((r) => r.action === "created").length;
  const hasBlockingTmdbIssues = unresolvedTmdbGenres.length > 0;

  // ── Media section derived state (selected asset + source/provenance + imported/pending) ──

  const posterProvenance = useMemo((): { source?: string; state: MediaAssetState } => {
    if (!form.posterUrl) return { state: "empty" };
    if (pendingMediaSelections.some((s) => s.imageType === "POSTER")) return { source: "TMDB", state: "pending" };
    const imported = movieImages.find((img) => img.imageType === "POSTER" && img.imageUrl === form.posterUrl);
    if (imported) return { source: imported.source, state: "imported" };
    return { source: form.tmdbId ? "TMDB" : "Manual", state: "manual" };
  }, [form.posterUrl, form.tmdbId, pendingMediaSelections, movieImages]);

  const selectedBackdrop = useMemo((): { url?: string; source?: string; state: MediaAssetState } => {
    const pendingBackdrop = pendingMediaSelections.find((s) => s.imageType === "BACKDROP");
    if (pendingBackdrop) {
      const candidate = tmdbMedia?.backdrops.find((c) => c.filePath === pendingBackdrop.filePath);
      return { url: candidate?.url, source: "TMDB", state: "pending" };
    }
    const imported = movieImages.find((img) => img.imageType === "BACKDROP" && img.isDefault)
      ?? movieImages.find((img) => img.imageType === "BACKDROP");
    if (imported) return { url: imported.imageUrl, source: imported.source, state: "imported" };
    return { state: "empty" };
  }, [pendingMediaSelections, tmdbMedia, movieImages]);
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
    setShowAllCast(true);
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

  const workflowSections = useMemo<MovieEditorSectionDefinition[]>(() =>
    MOVIE_EDITOR_SECTION_META.map(({ id, label, description }) => ({
      id,
      label,
      description,
      complete:
        id === "overview" ? Boolean(form.originalTitle.trim() && form.originalLanguage)
          : id === "classification-release" ? Boolean(form.durationMinutes > 0 && form.genreIds.length && form.formatIds.length)
            : id === "media" ? Boolean(form.posterUrl)
              : id === "credits" ? Boolean(form.selectedCompanies.length || form.cast.length)
                : !hasBlockingTmdbIssues,
    })),
  [form.originalTitle, form.originalLanguage, form.durationMinutes, form.genreIds.length, form.formatIds.length,
    form.posterUrl, form.selectedCompanies.length, form.cast.length, hasBlockingTmdbIssues]);

  const editableDraft = currentContentStatus == null || currentContentStatus === "DRAFT";
  const canSaveDraft = can.edit && editableDraft;
  const canSubmitForReview = can.submit && editableDraft;
  const displayedActionStatus: MovieEditorActionStatus =
    operation === "idle"
      && isDirty
      && actionStatus !== "save-error"
      && actionStatus !== "submit-error"
      && actionStatus !== "submitted"
      ? "dirty"
      : actionStatus;
  const exitDestination = editMovieId || activeMovieId ? "/admin/movies" : "/admin/movies/new";
  const requestExit = () => {
    if (isDirty) {
      setConfirmExitOpen(true);
      return;
    }
    navigate(exitDestination);
  };

  if (loadingMovie || catalogApplying) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1520px]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={requestExit}
            aria-label="Back from movie editor"
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
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-rose-500" />
          <p className="text-xs text-rose-600 leading-relaxed">{error}</p>
        </div>
      )}

      <MovieEditorActionBar
        status={displayedActionStatus}
        operation={operation}
        canSave={canSaveDraft}
        canSubmit={canSubmitForReview}
        saveDisabled={!isDirty}
        onSaveDraft={handleSaveDraft}
        onSubmitForReview={handleSubmitForReview}
      />

      <MovieEditorWorkflow sections={workflowSections}>

        {/* Existing form fields keep a single state owner; CSS order groups them by workflow. */}
        <div className="contents">

          {/* Basic Info */}
          <section
            id={movieEditorSectionDomId("overview")}
            data-editor-section="overview"
            tabIndex={-1}
            aria-labelledby="movie-editor-overview-title"
            className="order-1 scroll-mt-28 rounded-2xl border p-5 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <p id="movie-editor-overview-title" style={SL}>Overview</p>
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
                <label style={FL}>
                  Duration (minutes) <span className="text-rose-500">*</span>
                  {tmdbMissingRuntime && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded" style={{ fontSize: "9.5px", fontWeight: 700, background: "#fef3c7", color: "#92400e" }}>
                      TMDB HAD NO RUNTIME — CONFIRM
                    </span>
                  )}
                </label>
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
                  <span title="theatrical release — content metadata, not an exhibition window" style={{ display: "inline-flex", alignItems: "center", cursor: "help", color: "var(--text-sub)", marginLeft: "4px" }}>
                    <HelpCircle size={14} />
                  </span>
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
              {/* `[Frontend] Remove exhibition end date from Movie Editor`: end date is an
                  exhibition/scheduling decision, managed via the availability/showtime workflow
                  (see docs/MOVIE_SERVICE_BUSINESS_RULES.md) - never edited here, so a content
                  operator can't accidentally end a movie's exhibition window while just editing
                  its metadata. */}
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

          </section>

          {/* Genres & Formats */}
          <section
            id={movieEditorSectionDomId("classification-release")}
            data-editor-section="classification-release"
            tabIndex={-1}
            aria-labelledby="movie-editor-classification-title"
            className="order-2 scroll-mt-28 rounded-2xl border p-5 space-y-5 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <p id="movie-editor-classification-title" style={SL}>Classification &amp; Release</p>
            <div>
              <p style={{ ...SL, marginBottom: "10px" }}>Genres <span className="text-rose-500">*</span></p>
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
          <section className="order-1 rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
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
          <section
            id={movieEditorSectionDomId("credits")}
            data-editor-section="credits"
            tabIndex={-1}
            aria-labelledby="movie-editor-credits-title"
            className="order-4 scroll-mt-28 rounded-2xl border p-5 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <p id="movie-editor-credits-title" style={SL}>Credits</p>
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
                {(showAllCast ? form.cast : form.cast.slice(0, MAX_VISIBLE_CAST)).map((c, idx) => (
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
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="truncate" style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }} title={c.fullName}>{c.fullName}</span>
                    </div>
                    <select
                      value={c.roleType} onChange={(e) => updateCast(idx, "roleType", e.target.value as "ACTOR" | "DIRECTOR")}
                      className="px-2 py-1 rounded-lg border text-xs cursor-pointer flex-shrink-0 w-24"
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
                {form.cast.length > MAX_VISIBLE_CAST && (
                  <button
                    type="button"
                    onClick={() => setShowAllCast(!showAllCast)}
                    className="w-full py-2.5 mt-1 text-[13px] font-medium transition-colors rounded-xl border hover:bg-gray-50/50"
                    style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-main)" }}
                    aria-expanded={showAllCast}
                  >
                    {showAllCast ? "Show less" : `Show all cast (${form.cast.length})`}
                  </button>
                )}
              </div>
            )}
          </section>

                    {!form.tmdbId && (
            <section
              id={movieEditorSectionDomId("review")}
              data-editor-section="review"
              tabIndex={-1}
              aria-labelledby="movie-editor-review-title"
              className="order-5 scroll-mt-28 rounded-2xl border p-5 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
            >
              <p id="movie-editor-review-title" style={SL}>Review</p>
              <ReadinessSummary validationErrors={validationErrors} backendViolations={backendViolations} hasBlockingTmdbIssues={hasBlockingTmdbIssues} />
              <p className="mb-4" style={{ fontSize: "12px", color: "var(--text-sub)" }}>
                Review draft readiness before saving. Manual drafts have no external catalog mappings to resolve.
              </p>
            </section>
          )}
        </div>

        {/* Media and review content are part of the same full-width editor canvas. */}
        <div className="contents">

          {/* Media - Primary Poster, Backdrop, Official Trailer and Gallery all live in one
              canonical section (`[Frontend] Consolidate movie assets into a dedicated Media
              section`). Every group shows the selected asset, its source/provenance and
              imported/pending status via MediaAssetBadges/MediaThumbnail, so there's no need to
              jump between a poster card, a TMDB panel and a separate gallery to know what's
              actually going to be saved. */}
          <section
            id={movieEditorSectionDomId("media")}
            data-editor-section="media"
            tabIndex={-1}
            aria-labelledby="movie-editor-media-title"
            className="order-3 scroll-mt-28 rounded-2xl border p-5 space-y-6 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <p id="movie-editor-media-title" style={SL}>Media</p>

            {/* Primary Poster */}
            <div>
              <p className="mb-2" style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>Primary Poster</p>
              <div style={{ maxWidth: "220px" }}>
                {form.posterUrl ? (
                  <div className="relative mb-3">
                    <MediaThumbnail src={form.posterUrl} alt="Selected poster" emptyLabel="No poster selected yet" />
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
              </div>
              <MediaAssetBadges source={posterProvenance.source} state={posterProvenance.state} />

              {form.thumbnailUrl && form.thumbnailUrl !== form.posterUrl && (
                <div className="mt-3 flex items-center gap-2">
                  <img src={form.thumbnailUrl} alt="Thumbnail" className="w-12 h-16 rounded-lg object-cover border" style={{ borderColor: "var(--border-color)" }} />
                  <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>Thumbnail derivative (auto-generated from TMDB)</p>
                </div>
              )}
            </div>

            {/* Backdrop - Movie has no standalone backdrop URL field (only movie_image rows with
                imageType=BACKDROP), so "selected" here means the default/first BACKDROP image
                already imported, or one picked but not yet imported via the TMDB picker below. */}
            <div className="pt-5 border-t" style={{ borderColor: "var(--border-color)" }}>
              <p className="mb-2" style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>Backdrop</p>
              <div style={{ maxWidth: "320px" }}>
                <MediaThumbnail
                  src={selectedBackdrop.url}
                  alt="Selected backdrop"
                  aspectRatio="16 / 9"
                  emptyLabel="No backdrop selected yet"
                />
              </div>
              <MediaAssetBadges source={selectedBackdrop.source} state={selectedBackdrop.state} />
              <p className="mt-1.5" style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                {form.tmdbId
                  ? "Pick a different backdrop from the TMDB candidates below, or add one manually in the Gallery."
                  : "Add a backdrop manually in the Gallery below."}
              </p>
            </div>

            {/* Official Trailer */}
            <div className="pt-5 border-t" style={{ borderColor: "var(--border-color)" }}>
              <p className="mb-2" style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>Official Trailer</p>
              <input
                type="text" placeholder="https://www.youtube.com/watch?v=…" value={form.trailerUrl}
                onChange={(e) => { set("trailerUrl", e.target.value); setTrailerSource("MANUAL"); }}
                className={IC} style={IS}
              />
              {form.trailerUrl && !isLikelyVideoUrl(form.trailerUrl) && (
                <p className="mt-1.5 flex items-center gap-1" style={{ fontSize: "11px", color: "#b45309" }}>
                  <AlertCircle size={12} /> This doesn't look like a playable video URL — double check it before saving.
                </p>
              )}
              <MediaAssetBadges
                source={form.trailerUrl ? (trailerSource ?? "Manual") : undefined}
                state={form.trailerUrl ? (trailerSource === "TMDB" ? "imported" : "manual") : "empty"}
              />
              {tmdbTrailer && (
                <div className="mt-3 p-3 rounded-lg border" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                  <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", marginBottom: "4px" }}>Suggested trailer (TMDB)</p>
                  <a
                    href={tmdbTrailer.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "12px", color: "#2563eb", wordBreak: "break-all" }}
                  >
                    {tmdbTrailer.url}
                  </a>
                  {tmdbTrailer.videoType === "TEASER" && (
                    <span style={{ fontSize: "10.5px", color: "var(--text-sub)", marginLeft: "6px" }}>(teaser fallback - no trailer found)</span>
                  )}
                  {tmdbTrailer.url !== form.trailerUrl && (
                    <button
                      type="button"
                      onClick={() => { set("trailerUrl", tmdbTrailer.url); setTrailerSource("TMDB"); }}
                      className="mt-2 block px-2.5 py-1 rounded-lg border hover:bg-blue-50"
                      style={{ fontSize: "11.5px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
                    >
                      Use this trailer
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* TMDB media picker - only once a search result has been applied. Reused as-is
                (technical note: "Reuse TmdbMediaPicker logic nhưng tách UI theo section mới") -
                nothing here persists until Save; see TmdbMediaPicker's own pending-selection
                contract (movieId is only passed once the movie already exists). */}
            {tmdbMedia && form.tmdbId && (
              <div className="pt-5 border-t" style={{ borderColor: "var(--border-color)" }}>
                <TmdbMediaPicker
                  tmdbId={form.tmdbId}
                  media={tmdbMedia}
                  movieId={activeMovieId}
                  onPendingSelectionChange={setPendingMediaSelections}
                  onImported={() => {
                    if (activeMovieId) movieApi.getMovieImages(activeMovieId).then((r) => setMovieImages(r.result ?? [])).catch(() => {});
                  }}
                />
              </div>
            )}

            {/* Gallery */}
            <div className="pt-5 border-t" style={{ borderColor: "var(--border-color)" }}>
              <p className="mb-2" style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>Gallery</p>
              {activeMovieId && (
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
                        <div key={img.imageId} className="relative rounded-xl overflow-hidden">
                          <MediaThumbnail src={img.imageUrl} alt={img.caption || img.imageType} aspectRatio="1 / 1" emptyLabel="No preview" />
                          <div className="absolute inset-x-0 bottom-0 px-1.5 py-1" style={{ background: "rgba(0,0,0,0.55)" }}>
                            <span className="px-1 py-0.5 rounded text-white" style={{ fontSize: "9px", background: "rgba(255,255,255,0.2)" }}>{img.imageType}</span>
                            {img.source && (
                              <span className="ml-1 px-1 py-0.5 rounded text-white" style={{ fontSize: "9px", background: "rgba(255,255,255,0.2)" }}>{img.source}</span>
                            )}
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
            </div>
          </section>

          {/* Source provenance remains visible after the full-width catalog populates this draft. */}
                    {form.tmdbId && (
            <section
              id={movieEditorSectionDomId("review")}
              data-editor-section="review"
              tabIndex={-1}
              aria-labelledby="movie-editor-review-title"
              className="order-5 scroll-mt-28 rounded-2xl border p-5 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 space-y-4"
              style={{ background: "var(--bg-card)", borderColor: hasBlockingTmdbIssues ? "#f87171" : "var(--border-color)" }}
            >
              <p id="movie-editor-review-title" style={SL}>Review</p>
              <ReadinessSummary validationErrors={validationErrors} backendViolations={backendViolations} hasBlockingTmdbIssues={hasBlockingTmdbIssues} />
              
              <p className="mb-2 mt-4" style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-sub)" }}>Catalog provenance</p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50" style={{ width: "fit-content" }}>
                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0"><Check size={10} className="text-white" /></div>
                  <span style={{ fontSize: "12px", color: "#065f46", fontWeight: 500 }}>TMDB Catalog</span>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>·</span>
                  <a href={`https://www.themoviedb.org/movie/${form.tmdbId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#059669", fontWeight: 500, textDecoration: "none" }}>#${form.tmdbId}</a>
                </div>
              </div>

              {(tmdbWarnings.length > 0 || tmdbUnmappedGenres.length > 0 || form.selectedCompanies.some(c => c.companyId == null) || form.cast.some(c => c.personId == null)) && (
                <div className="mt-6 pt-4 border-t space-y-4" style={{ borderColor: "var(--border-color)" }}>
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} className={hasBlockingTmdbIssues ? "text-red-500" : "text-amber-500"} />
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)", marginBottom: 0 }}>TMDB Import Warnings & Mappings</p>
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
                                    {resolution.action === "created" && "Will create as Pending Review on save"}
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
                                      type="button"
                                      onClick={() => resolveGenreCreateNew(g.tmdbGenreId)}
                                      className="px-2 py-1 rounded border hover:bg-blue-50"
                                      style={{ fontSize: "12px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
                                    >
                                      Create new
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
                  
                  {/* Additional Master-Data Mappings for Companies and Persons */}
                  {(form.selectedCompanies.length > 0 || form.cast.length > 0) && (
                    <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                      <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)", marginBottom: "12px" }}>
                        Master-data mapping summary
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {form.selectedCompanies.length > 0 && (
                          <div className="space-y-2">
                            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Companies</p>
                            <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                              {form.selectedCompanies.map((c, i) => (
                                <div key={`company-${i}`} className="flex items-center justify-between px-2.5 py-1.5 rounded-md border" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", fontSize: "12px" }}>
                                  <span className="truncate mr-2" style={{ color: "var(--text-main)" }} title={c.name}>{c.name}</span>
                                  {c.companyId ? (
                                    <span className="text-emerald-600 font-medium text-[10.5px] flex-shrink-0">✓ Mapped</span>
                                  ) : (
                                    <span className="text-amber-600 font-medium text-[10.5px] flex-shrink-0">Suggested</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {form.cast.length > 0 && (
                          <div className="space-y-2">
                            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Cast & Crew</p>
                            <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                              {form.cast.map((p, i) => (
                                <div key={`person-${p._key}`} className="flex items-center justify-between px-2.5 py-1.5 rounded-md border" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", fontSize: "12px" }}>
                                  <span className="truncate mr-2" style={{ color: "var(--text-main)" }} title={p.fullName}>
                                    {p.fullName} <span style={{ color: "var(--text-muted)", fontSize: "10.5px", fontWeight: 500 }}>({p.roleType})</span>
                                  </span>
                                  {p.personId ? (
                                    <span className="text-emerald-600 font-medium text-[10.5px] flex-shrink-0">✓ Mapped</span>
                                  ) : (
                                    <span className="text-amber-600 font-medium text-[10.5px] flex-shrink-0">Suggested</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </section>
          )}
        </div>
      </MovieEditorWorkflow>

      {confirmExitOpen && (
        <ConfirmDialog
          title="Discard unsaved movie changes?"
          body="Your latest edits have not been saved as a draft. Leaving now will permanently discard those changes."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          danger
          busy={submitting}
          onCancel={() => setConfirmExitOpen(false)}
          onConfirm={() => navigate(exitDestination)}
        />
      )}
    </div>
  );
}
