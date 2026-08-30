import {
  X, Film, Tag, Globe, Users, Clock, Calendar, MapPin,
  Building2, ExternalLink, Play, Loader2, ChevronDown, ChevronLeft, ChevronRight, Image as ImageIcon,
  AlertTriangle, Check, CheckCircle2, History, UserRound, XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { movieApi, type MovieResponse, type MovieStatusHistoryResponse } from "../api/movieApi";
import {
  MOVIE_CONTENT_STATUS_META,
  toMovieContentStatus,
} from "../utils/movieContentStatus";
import { useRole } from "../hooks/useRole";

/** Shared read-only detail view (mode="view", used from the movie catalog) and the
 *  content-approval workflow (mode="review", used from the pending-review queue) were
 *  originally two near-identical components (~90% duplicate JSX after parallel redesigns).
 *  They're merged here behind a `mode` prop so a layout fix only needs to happen once — see #139. */
type BaseProps = {
  open: boolean;
  movie: MovieResponse | null;
  loading?: boolean;
  onClose: () => void;
};

type ViewModeProps = BaseProps & { mode?: "view" };
type ReviewModeProps = BaseProps & {
  mode: "review";
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number, note: string) => Promise<void>;
};

type Props = ViewModeProps | ReviewModeProps;

type TabKey = "overview" | "media" | "credits" | "activity";

type ReviewCheck = {
  key: string;
  label: string;
  detail: string;
  passed: boolean;
};

const MIN_NOTE_LENGTH = 10;

const LANG_NAME: Record<string, string> = {
  en: "English", vi: "Tiếng Việt", ja: "日本語", ko: "한국어",
  zh: "中文", fr: "Français", th: "ภาษาไทย", ug: "Uyghur",
};

const READINESS_FIELD_LABELS: Record<string, string> = {
  ageRating: "age rating",
  poster: "poster",
  synopsis: "synopsis",
  translations: "localized title",
  genres: "genre",
  formats: "screening format",
  originalTitle: "original title",
  originalLanguage: "original language",
  durationMinutes: "duration",
  releaseDate: "release date",
};

const FL: React.CSSProperties = {
  fontSize: "11px", lineHeight: "16px", fontWeight: 700, letterSpacing: "0.07em",
  textTransform: "uppercase", color: "var(--text-sub)", marginBottom: "4px",
};

function approvalErrorMessage(err: any) {
  const response = err?.response?.data;
  const violations = response?.result?.violations;
  if (!Array.isArray(violations) || violations.length === 0) {
    return response?.message ?? "Approve failed.";
  }

  const fields = [...new Set(
    violations
      .map((violation: { field?: string }) =>
        READINESS_FIELD_LABELS[violation.field ?? ""] ?? violation.field
      )
      .filter(Boolean)
  )];

  return `${response?.message ?? "Movie is not ready for approval."} Check: ${fields.join(", ")}.`;
}

function formatDuration(minutes?: number) {
  if (!minutes) return "Not set";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function formatDate(value?: string) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
}

function formatWorkflowStatus(value?: string) {
  if (!value) return "Created";
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function SectionLabel({ icon: Icon, children }: { icon: typeof Tag; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon size={12} style={{ color: "var(--text-sub)" }} />
      <p style={FL}>{children}</p>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, description }: {
  icon: typeof Film;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--bg-hover)", color: "var(--text-sub)" }}>
        <Icon size={17} />
      </div>
      <div>
        <h3 className="text-[17px] font-bold leading-6" style={{ color: "var(--text-main)" }}>{title}</h3>
        {description && <p className="mt-0.5 text-xs" style={{ color: "var(--text-sub)" }}>{description}</p>}
      </div>
    </div>
  );
}

const AGE_RATING_META: Record<string, { label: string; color: string; background: string; border: string }> = {
  P: { label: "All ages", color: "#047857", background: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)" },
  K: { label: "Under 13 with a guardian", color: "#0369a1", background: "rgba(14,165,233,0.1)", border: "rgba(14,165,233,0.3)" },
  T13: { label: "Ages 13 and over", color: "#a16207", background: "rgba(234,179,8,0.11)", border: "rgba(234,179,8,0.32)" },
  T16: { label: "Ages 16 and over", color: "#c2410c", background: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)" },
  T18: { label: "Ages 18 and over", color: "#be123c", background: "rgba(244,63,94,0.1)", border: "rgba(244,63,94,0.3)" },
  C: { label: "Not permitted for exhibition", color: "#b91c1c", background: "rgba(220,38,38,0.1)", border: "rgba(220,38,38,0.3)" },
};

function AgeRatingDisplay({ code, description }: { code?: string; description?: string }) {
  if (!code) {
    return (
      <span className="text-sm font-semibold text-rose-600">
        Age classification has not been supplied.
      </span>
    );
  }

  const meta = AGE_RATING_META[code] ?? {
    label: "Age classification",
    color: "var(--text-main)",
    background: "var(--bg-hover)",
    border: "var(--border-color)",
  };

  return (
    <div className="flex min-w-0 items-center gap-2.5" title={description}>
      <span className="flex h-8 min-w-8 flex-shrink-0 items-center justify-center rounded-md border px-1.5 text-xs font-black tracking-wide" style={{ color: meta.color, borderColor: meta.border, background: meta.background }}>
        {code}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold" style={{ color: "var(--text-main)" }}>{meta.label}</span>
        {description && description !== meta.label && <span className="block truncate text-xs" style={{ color: "var(--text-sub)" }}>{description}</span>}
      </span>
    </div>
  );
}

/** Metadata row for the fixed left-hand poster rail — icon+label left, value right. */
function MetaRow({ icon: Icon, label, value }: { icon: typeof Film; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="flex flex-shrink-0 items-center gap-1.5 text-[12.5px] font-medium leading-5" style={{ color: "var(--text-sub)" }}>
        <Icon size={12} />{label}
      </span>
      <span className="text-right text-[13px] font-semibold leading-5" style={{ color: "var(--text-main)" }}>{value}</span>
    </div>
  );
}

export function MovieDetailModal(props: Props) {
  const { open, movie, loading, onClose } = props;
  const mode = props.mode ?? "view";
  const isReview = mode === "review";
  const reviewProps = props.mode === "review" ? props : null;
  const { can, username } = useRole();

  const [synopsisLang, setSynopsisLang] = useState<"vi" | "en">("vi");
  const [mediaIdx, setMediaIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showPassedChecks, setShowPassedChecks] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [history, setHistory] = useState<MovieStatusHistoryResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const mediaTouchStartX = useRef<number | null>(null);

  const handleClose = () => {
    if (isReview && submitting) return;
    setShowRejectForm(false);
    setShowPassedChecks(false);
    setNote("");
    onClose();
  };

  // Esc-to-close + body scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, submitting]);

  // Reset per-movie so switching movies without closing the modal doesn't carry over
  // the previous movie's selected tab/gallery slide/reject-note draft.
  useEffect(() => {
    setActiveTab("overview");
    setMediaIdx(0);
    setShowRejectForm(false);
    setShowPassedChecks(false);
    setNote("");
  }, [movie?.movieId, open]);

  useEffect(() => {
    if (!open || !isReview || !movie?.movieId) {
      setHistory([]);
      setHistoryUnavailable(false);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryUnavailable(false);
    movieApi.getMovieStatusHistory(movie.movieId)
      .then((response) => { if (!cancelled) setHistory(response.result ?? []); })
      .catch(() => { if (!cancelled) { setHistory([]); setHistoryUnavailable(true); } })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [isReview, movie?.movieId, open]);

  const vi = movie?.translations?.find(t => t.languageCode === "vi");
  const en = movie?.translations?.find(t => t.languageCode === "en");
  const directors = movie?.cast?.filter(c => c.roleType === "DIRECTOR") ?? [];
  const actors = movie?.cast?.filter(c => c.roleType === "ACTOR") ?? [];
  const contentStatus = movie ? toMovieContentStatus(movie.status) : "DRAFT";
  const status = MOVIE_CONTENT_STATUS_META[contentStatus];
  const images = movie?.images ?? [];
  const poster = images.find(i => i.imageType === "POSTER" && i.isDefault) ?? images.find(i => i.imageType === "POSTER");
  const posterUrl = poster?.imageUrl ?? movie?.posterUrl;
  const title = en?.title ?? movie?.originalTitle ?? "Untitled movie";
  const localizedTitle = vi?.title || en?.title || movie?.originalTitle || "Untitled movie";
  const showOriginalTitle = Boolean(movie?.originalTitle && movie.originalTitle.toLocaleLowerCase() !== localizedTitle.toLocaleLowerCase());
  const primarySynopsis = vi?.synopsis || en?.synopsis || movie?.synopsis || "";
  const submittedEvent = history.find((entry) => entry.toStatus === "PENDING_REVIEW");
  const contentSource = movie?.tmdbId ? `TMDB linked · ${movie.tmdbId}` : "Internal catalogue";
  const selfApproval = Boolean(username && movie?.createdBy && username.toLocaleLowerCase() === movie.createdBy.toLocaleLowerCase());

  // Every asset (poster + backdrops + stills), poster first — feeds the Media tab's carousel.
  const mediaImages = images.length > 0
    ? [...images].sort((a, b) => (a.imageType === "POSTER" ? -1 : b.imageType === "POSTER" ? 1 : 0))
    : (posterUrl ? [{ imageId: -1, imageUrl: posterUrl, imageType: "POSTER" as const, caption: undefined }] : []);
  const SWIPE_THRESHOLD_PX = 40;
  const handleMediaTouchStart = (e: React.TouchEvent) => { mediaTouchStartX.current = e.touches[0].clientX; };
  const handleMediaTouchEnd = (e: React.TouchEvent) => {
    if (mediaTouchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - mediaTouchStartX.current;
    if (mediaImages.length > 1 && Math.abs(delta) > SWIPE_THRESHOLD_PX) {
      setMediaIdx((i) => {
        const dir = delta < 0 ? 1 : -1;
        return (i + dir + mediaImages.length) % mediaImages.length;
      });
    }
    mediaTouchStartX.current = null;
  };

  const readinessChecks = useMemo<ReviewCheck[]>(() => {
    if (!movie) return [];
    const activeGenres = movie.genres?.filter((genre) => genre.status !== "PENDING_REVIEW") ?? [];
    const hasLocalizedTitle = movie.translations?.some((translation) => translation.title?.trim());
    const hasSynopsis = Boolean(movie.synopsis?.trim() || movie.translations?.some((translation) => translation.synopsis?.trim()));
    const validLanguage = /^[a-zA-Z]{2}$/.test(movie.originalLanguage ?? "");

    return [
      { key: "identity", label: "Title & original language", detail: validLanguage ? `${movie.originalTitle} · ${movie.originalLanguage.toUpperCase()}` : "A title and two-letter language code are required.", passed: Boolean(movie.originalTitle?.trim()) && validLanguage },
      { key: "runtime", label: "Runtime", detail: movie.durationMinutes > 0 ? formatDuration(movie.durationMinutes) : "Runtime must be greater than zero.", passed: movie.durationMinutes > 0 },
      { key: "genre", label: "Approved genres", detail: activeGenres.length ? activeGenres.map((genre) => genre.genreName).join(", ") : "At least one active genre is required.", passed: activeGenres.length > 0 && activeGenres.length === (movie.genres?.length ?? 0) },
      { key: "format", label: "Screening formats", detail: movie.formats?.length ? movie.formats.map((format) => format.formatCode).join(", ") : "At least one screening format is required.", passed: Boolean(movie.formats?.length) },
      { key: "classification", label: "Vietnam age classification", detail: movie.ageRating ? `${movie.ageRating.ratingCode} · ${movie.ageRating.description}` : "An age classification is required before approval.", passed: Boolean(movie.ageRating && movie.ageRating.ratingCode !== "C") },
      { key: "poster", label: "Primary poster", detail: posterUrl ? "Primary artwork is available." : "A primary poster is required.", passed: Boolean(posterUrl) },
      { key: "editorial", label: "Localized title & synopsis", detail: hasLocalizedTitle && hasSynopsis ? `${movie.translations?.length ?? 0} localized version(s) available.` : "A localized title and synopsis are required.", passed: Boolean(hasLocalizedTitle && hasSynopsis) },
    ];
  }, [movie, posterUrl]);

  const blockers = readinessChecks.filter((check) => !check.passed);
  const passedChecks = readinessChecks.filter((check) => check.passed);
  const warnings = movie ? [
    !movie.releaseDate ? "Release date has not been scheduled." : null,
    !movie.trailerUrl ? "No trailer is attached." : null,
    images.length <= (posterUrl ? 1 : 0) ? "No gallery artwork is attached." : null,
    directors.length === 0 ? "No director credit is available." : null,
    !movie.companies?.length ? "No production company is linked." : null,
    !vi?.title || !vi?.synopsis ? "Vietnamese title or synopsis is incomplete." : null,
  ].filter((warning): warning is string => Boolean(warning)) : [];

  const noteTooShort = note.trim().length > 0 && note.trim().length < MIN_NOTE_LENGTH;
  const approvalReady = Boolean(movie) && blockers.length === 0;
  const decisionReady = approvalReady && !selfApproval;
  const passedCount = readinessChecks.length - blockers.length;

  const tabs = useMemo(() => {
    if (isReview) {
      return [
        { key: "overview" as TabKey, label: "Content", show: true },
        { key: "media" as TabKey, label: "Assets & credits", show: true },
        { key: "activity" as TabKey, label: "Activity", show: true },
      ];
    }
    const list: Array<{ key: TabKey; label: string; show: boolean }> = [
      { key: "overview", label: "Overview", show: true },
      { key: "media", label: "Media", show: mediaImages.length > 0 },
      { key: "credits", label: "Cast & Crew", show: directors.length > 0 || actors.length > 0 },
    ];
    return list.filter((t) => t.show);
  }, [actors.length, directors.length, isReview, mediaImages.length]);

  const tab = tabs.some(t => t.key === activeTab) ? activeTab : "overview";

  const dims = isReview
    ? {
        shell: "h-[min(94vh,920px)] max-w-[1320px]",
        asideW: "lg:w-[300px]",
        asideGap: "gap-5",
        asidePad: "p-5 lg:p-6",
        headerPad: "py-4",
        tabPad: "px-4 py-4",
        mainPad: "p-6 lg:p-8",
      }
    : {
        shell: "h-[min(94vh,820px)] max-w-3xl",
        asideW: "lg:w-[280px]",
        asideGap: "gap-4",
        asidePad: "p-4 lg:p-5",
        headerPad: "py-3",
        tabPad: "px-3.5 py-2.5",
        mainPad: "p-4 sm:p-5",
      };

  const handleApprove = async () => {
    if (!movie || !decisionReady || !reviewProps) return;
    setSubmitting("approve");
    try {
      await reviewProps.onApprove(movie.movieId);
      toast.success(`"${movie.originalTitle}" approved.`);
      onClose();
    } catch (err: any) {
      toast.error(approvalErrorMessage(err));
    } finally {
      setSubmitting(null);
    }
  };

  const handleReject = async () => {
    if (!movie || note.trim().length < MIN_NOTE_LENGTH || !reviewProps) return;
    setSubmitting("reject");
    try {
      await reviewProps.onReject(movie.movieId, note.trim());
      toast.success(`Changes requested for "${movie.originalTitle}".`);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Request changes failed.");
    } finally {
      setSubmitting(null);
    }
  };

  if (!open) return null;

  // Keep the portal inside the active AdminLayout theme scope. Querying for any dark
  // descendant can select stale/hidden UI and incorrectly force a light page into dark mode.
  const portalRoot = document.querySelector<HTMLElement>("#root > .theme-dark, #root > .theme-light")
    ?? document.querySelector<HTMLElement>(".theme-dark, .theme-light")
    ?? document.body;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-5" style={{ zIndex: 1000, isolation: "isolate" }}>
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default backdrop-blur-[3px]" style={{ background: "var(--modal-backdrop, rgba(15, 23, 42, 0.42))" }} onClick={handleClose} />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="movie-detail-title"
        className={`relative flex w-full flex-col overflow-hidden rounded-2xl border shadow-2xl ${dims.shell}`}
        style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", zIndex: 1001 }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* ── Header ── */}
        <header className={`flex flex-shrink-0 items-center justify-between gap-4 border-b px-5 sm:px-6 lg:px-7 ${dims.headerPad}`} style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          {isReview && movie ? (
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="h-[68px] w-12 flex-shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: "var(--border-color)", background: "var(--bg-hover)" }}>
                {posterUrl
                  ? <img src={posterUrl} alt="" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center" style={{ color: "var(--text-sub)" }}><ImageIcon size={17} /></div>}
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-bold uppercase leading-4 tracking-[0.09em] text-blue-600">Movie content submission</p>
                <h2 id="movie-detail-title" className="truncate text-xl font-bold leading-7" style={{ color: "var(--text-main)" }}>{localizedTitle}</h2>
                <p className="mt-0.5 truncate text-[13px] leading-5" style={{ color: "var(--text-sub)" }}>
                  {showOriginalTitle ? movie.originalTitle : "Content record awaiting an independent decision"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><Film size={20} /></div>
              <div className="min-w-0">
                <h2 id="movie-detail-title" className="truncate text-lg font-bold" style={{ color: "var(--text-main)" }}>{isReview ? "Content approval" : "Movie details"}</h2>
                <p className="mt-0.5 truncate text-sm" style={{ color: "var(--text-sub)" }}>{isReview ? "Loading catalog record…" : "Full catalog record — read-only preview."}</p>
              </div>
            </div>
          )}
          {isReview && movie && <span className="ml-auto hidden flex-shrink-0 rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold uppercase leading-4 tracking-[0.06em] text-amber-600 sm:inline-flex">Pending review</span>}
          <button type="button" onClick={handleClose} disabled={isReview && Boolean(submitting)} aria-label="Close" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5" style={{ color: "var(--text-sub)" }}><X size={20} /></button>
        </header>

        {isReview && movie && !loading && (
          <section className="grid flex-shrink-0 grid-cols-2 border-b sm:grid-cols-4" aria-label="Submission information" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
            <div className="border-b px-5 py-3.5 sm:border-b-0 sm:border-r lg:px-6" style={{ borderColor: "var(--border-color)" }}>
              <p style={FL}>{submittedEvent ? "Submitted" : "Last updated"}</p>
              <p className="truncate text-[13px] font-semibold leading-5" style={{ color: "var(--text-main)" }}>{formatDateTime(submittedEvent?.createdAt || movie.updatedAt)}</p>
            </div>
            <div className="border-b px-5 py-3.5 sm:border-b-0 sm:border-r lg:px-6" style={{ borderColor: "var(--border-color)" }}>
              <p style={FL}>{submittedEvent ? "Submitted by" : "Last changed by"}</p>
              <p className="truncate text-[13px] font-semibold leading-5" style={{ color: "var(--text-main)" }}>{submittedEvent?.actor || movie.updatedBy || movie.createdBy || "Not recorded"}</p>
            </div>
            <div className="border-r px-5 py-3.5 lg:px-6" style={{ borderColor: "var(--border-color)" }}>
              <p style={FL}>Record version</p>
              <p className="truncate text-[13px] font-semibold leading-5" style={{ color: "var(--text-main)" }}>{movie.version != null ? `Version ${movie.version}` : "Not recorded"}</p>
            </div>
            <div className="px-5 py-3.5 lg:px-6">
              <p style={FL}>Source linkage</p>
              <p className="truncate text-[13px] font-semibold leading-5" style={{ color: "var(--text-main)" }}>{contentSource}</p>
            </div>
          </section>
        )}

        {loading || !movie ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3" style={{ color: "var(--text-sub)" }}>
            <Loader2 size={28} className="animate-spin" />
            <p style={{ fontSize: "14px" }}>Loading movie {isReview ? "record" : "details"}…</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* The catalog viewer keeps its poster rail. Review mode uses a compact identity header. */}
            {!isReview && <aside
              className={`flex flex-shrink-0 flex-col ${dims.asideGap} overflow-y-auto border-b ${dims.asidePad} ${dims.asideW} lg:border-b-0 lg:border-r`}
              style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
            >
              <div className="mx-auto w-40 flex-shrink-0 overflow-hidden rounded-2xl border shadow-sm lg:mx-0 lg:w-full" style={{ borderColor: "var(--border-color)", background: "var(--bg-hover)" }}>
                {posterUrl
                  ? <img src={posterUrl} alt={movie.originalTitle} className="aspect-[2/3] w-full object-cover" />
                  : <div className="flex aspect-[2/3] w-full items-center justify-center" style={{ color: "var(--text-sub)" }}><ImageIcon size={32} /></div>}
              </div>

              <div>
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  {!isReview && (
                    <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ color: status.dot, background: `${status.dot}26`, border: `1px solid ${status.dot}40` }}>
                      {status.label}
                    </span>
                  )}
                  <span className="text-xs font-semibold" style={{ color: "var(--text-sub)" }}>#{movie.movieId}</span>
                  {!isReview && movie.ageRating && (
                    <span
                      title={movie.ageRating.description}
                      className="rounded-md px-2 py-0.5 text-[11px] font-extrabold tracking-wide"
                      style={{ background: "#dc2626", color: "#fff", lineHeight: "15px" }}
                    >
                      {movie.ageRating.ratingCode}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold leading-snug" style={{ color: "var(--text-main)" }}>{title}</h3>
                {vi?.title && vi.title !== title && <p className="mt-0.5 text-sm" style={{ color: "var(--text-sub)" }}>{vi.title}</p>}
              </div>

              <div className="rounded-xl border px-4" style={{ borderColor: "var(--border-color)" }}>
                <MetaRow icon={Clock} label="Runtime" value={movie.durationMinutes ? formatDuration(movie.durationMinutes) : "Not set"} />
                <div className="border-t" style={{ borderColor: "var(--border-color)" }} />
                <MetaRow icon={Calendar} label="Release" value={formatDate(movie.releaseDate)} />
                <div className="border-t" style={{ borderColor: "var(--border-color)" }} />
                <MetaRow icon={Globe} label="Language" value={LANG_NAME[movie.originalLanguage] ?? movie.originalLanguage ?? "Not set"} />
                <div className="border-t" style={{ borderColor: "var(--border-color)" }} />
                <MetaRow icon={MapPin} label="Country" value={movie.country ?? "Not set"} />
              </div>

              {!isReview && movie.genres?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {movie.genres.map(g => (
                    <span key={g.genreId} className="rounded-md border px-2 py-1 text-[11px] font-medium" style={{ background: "var(--bg-main)", color: "var(--text-sub)", borderColor: "var(--border-color)" }}>
                      {g.genreName}
                    </span>
                  ))}
                </div>
              )}

            </aside>}

            {/* ── Scrollable right pane: tabs + content ── */}
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Changes requested reason — surfaced above the tabs since it's actionable
                  regardless of which tab is active or which mode the modal is in. */}
              {contentStatus === "CHANGES_REQUESTED" && movie.rejectionNote && (
                <div className="mx-5 mt-4 flex-shrink-0 rounded-xl border p-3 sm:mx-6" style={{ borderColor: "rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.06)" }}>
                  <p style={{ ...FL, color: "#dc2626", marginBottom: "2px" }}>Changes requested</p>
                  <p style={{ fontSize: "13px", color: "var(--text-main)", lineHeight: 1.6 }}>{movie.rejectionNote}</p>
                </div>
              )}

              <nav className="flex flex-shrink-0 gap-1 overflow-x-auto border-b px-5 sm:px-6" aria-label="Movie detail sections" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                {tabs.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className={`relative whitespace-nowrap ${dims.tabPad} text-sm font-semibold transition-colors`}
                    style={{ color: tab === t.key ? "#2563eb" : "var(--text-sub)" }}
                  >
                    {t.label}
                    {tab === t.key && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-600" />}
                  </button>
                ))}
              </nav>

              <main className={isReview
                ? "nice-scrollbar min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:overflow-hidden"
                : `nice-scrollbar min-h-0 flex-1 overflow-y-auto ${dims.mainPad}`}
              >
                <div className={isReview ? `nice-scrollbar min-h-0 ${dims.mainPad} lg:overflow-y-auto` : "contents"}>
                {tab === "overview" && !isReview && (
                  <div className="space-y-3">
                    {(vi?.tagline || en?.tagline || movie.tagline) && (
                      <p style={{ fontSize: "13.5px", fontStyle: "italic", color: "var(--text-sub)" }}>
                        “{synopsisLang === "vi" ? (vi?.tagline ?? en?.tagline ?? movie.tagline) : (en?.tagline ?? vi?.tagline ?? movie.tagline)}”
                      </p>
                    )}

                    {(vi?.synopsis || en?.synopsis) && (
                      <section className="rounded-2xl border p-3.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                        <div className="mb-2 flex items-center justify-between">
                          <SectionLabel icon={Globe}>Synopsis</SectionLabel>
                          <div className="flex gap-1">
                            {vi?.synopsis && (
                              <button type="button" onClick={() => setSynopsisLang("vi")}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                                style={{ background: synopsisLang === "vi" ? "var(--bg-hover)" : "transparent", color: synopsisLang === "vi" ? "var(--text-main)" : "var(--text-sub)", border: `1px solid ${synopsisLang === "vi" ? "var(--border-color)" : "transparent"}` }}>
                                🇻🇳 VI
                              </button>
                            )}
                            {en?.synopsis && (
                              <button type="button" onClick={() => setSynopsisLang("en")}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                                style={{ background: synopsisLang === "en" ? "var(--bg-hover)" : "transparent", color: synopsisLang === "en" ? "var(--text-main)" : "var(--text-sub)", border: `1px solid ${synopsisLang === "en" ? "var(--border-color)" : "transparent"}` }}>
                                🇬🇧 EN
                              </button>
                            )}
                          </div>
                        </div>
                        <p style={{ fontSize: "13.5px", color: "var(--text-main)", lineHeight: 1.65 }}>
                          {synopsisLang === "vi" ? (vi?.synopsis ?? en?.synopsis) : (en?.synopsis ?? vi?.synopsis)}
                        </p>
                      </section>
                    )}

                    {movie.formats?.length > 0 && (
                      <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                        <SectionLabel icon={Film}>Screening formats</SectionLabel>
                        <div className="flex flex-wrap gap-2">
                          {movie.formats.map(f => (
                            <span key={f.formatId} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>{f.formatCode}</span>
                          ))}
                        </div>
                      </section>
                    )}

                    {movie.companies && movie.companies.length > 0 && (
                      <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                        <SectionLabel icon={Building2}>Production</SectionLabel>
                        <p style={{ fontSize: "13px", color: "var(--text-main)" }}>
                          {movie.companies.map((c) => c.name).join(", ")}
                        </p>
                      </section>
                    )}

                    {(movie.tmdbId || movie.imdbId || movie.trailerUrl) && (
                      <div className="flex flex-wrap gap-2">
                        {movie.tmdbId && (
                          <a
                            href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors hover:border-blue-400"
                            style={{ borderColor: "var(--border-color)", fontSize: "12px", color: "var(--text-sub)", textDecoration: "none" }}
                          >
                            <ExternalLink size={12} /> TMDB #{movie.tmdbId}
                          </a>
                        )}
                        {movie.imdbId && (
                          <a
                            href={`https://www.imdb.com/title/${movie.imdbId}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors hover:border-amber-400"
                            style={{ borderColor: "var(--border-color)", fontSize: "12px", color: "var(--text-sub)", textDecoration: "none" }}
                          >
                            <ExternalLink size={12} /> IMDb
                          </a>
                        )}
                        {movie.trailerUrl && (
                          <a
                            href={movie.trailerUrl}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors hover:border-rose-400"
                            style={{ borderColor: "var(--border-color)", fontSize: "12px", color: "var(--text-sub)", textDecoration: "none" }}
                          >
                            <Play size={12} /> Watch Trailer
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {tab === "overview" && isReview && (
                  <div className="mx-auto w-full max-w-4xl">
                    <section className="pb-7">
                      <p className="text-[11px] font-bold uppercase leading-4 tracking-[0.09em] text-blue-600">Customer-facing content</p>
                      <h3 className="mt-1 text-[17px] font-bold leading-6" style={{ color: "var(--text-main)" }}>Title and synopsis</h3>
                      <p className="mt-1 text-xs leading-[18px]" style={{ color: "var(--text-sub)" }}>Review the information customers will see across booking channels.</p>

                      <dl className="mt-5">
                        <div className="grid gap-1 py-3.5 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-6">
                          <dt className="text-[13px] font-semibold leading-5" style={{ color: "var(--text-sub)" }}>Display title</dt>
                          <dd className="text-sm font-semibold leading-[22px]" style={{ color: "var(--text-main)" }}>{vi?.title || en?.title || movie.originalTitle}</dd>
                        </div>
                        <div className="grid gap-1 border-t py-3.5 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-6" style={{ borderColor: "var(--border-color)" }}>
                          <dt className="text-[13px] font-semibold leading-5" style={{ color: "var(--text-sub)" }}>Synopsis</dt>
                          <dd className="text-sm leading-[22px]" style={{ color: primarySynopsis ? "var(--text-main)" : "#dc2626" }}>{primarySynopsis || "Synopsis has not been supplied."}</dd>
                        </div>
                        {(vi?.tagline || en?.tagline || movie.tagline) && (
                          <div className="grid gap-1 border-t py-3.5 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-6" style={{ borderColor: "var(--border-color)" }}>
                            <dt className="text-[13px] font-semibold leading-5" style={{ color: "var(--text-sub)" }}>Tagline</dt>
                            <dd className="text-sm italic leading-[22px]" style={{ color: "var(--text-main)" }}>“{vi?.tagline || en?.tagline || movie.tagline}”</dd>
                          </div>
                        )}
                        <div className="grid gap-1 border-t py-3.5 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-6" style={{ borderColor: "var(--border-color)" }}>
                          <dt className="text-[13px] font-semibold leading-5" style={{ color: "var(--text-sub)" }}>Languages</dt>
                          <dd className="flex flex-wrap gap-1.5">
                            {movie.translations?.map((translation) => <span key={translation.languageCode} className="rounded-md border px-2 py-0.5 text-xs font-semibold uppercase leading-[18px]" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>{translation.languageCode}</span>)}
                            {!movie.translations?.length && <span className="text-sm text-rose-600">No localized content supplied.</span>}
                          </dd>
                        </div>
                      </dl>
                    </section>

                    <section className="border-t py-7" style={{ borderColor: "var(--border-color)" }}>
                      <p className="text-[11px] font-bold uppercase leading-4 tracking-[0.09em] text-blue-600">Classification</p>
                      <h3 className="mt-1 text-[17px] font-bold leading-6" style={{ color: "var(--text-main)" }}>Release information</h3>

                      <dl className="mt-4">
                        <div className="grid items-center gap-2 py-3.5 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-6">
                          <dt className="text-[13px] font-semibold leading-5" style={{ color: "var(--text-sub)" }}>Age rating</dt>
                          <dd><AgeRatingDisplay code={movie.ageRating?.ratingCode} description={movie.ageRating?.description} /></dd>
                        </div>
                        <div className="grid items-start gap-2 border-t py-3.5 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-6" style={{ borderColor: "var(--border-color)" }}>
                          <dt className="text-[13px] font-semibold leading-5" style={{ color: "var(--text-sub)" }}>Genres</dt>
                          <dd className="flex flex-wrap gap-1.5">
                            {movie.genres?.map((genre) => <span key={genre.genreId} className="rounded-md border px-2.5 py-1 text-[13px] font-medium leading-5" style={{ borderColor: genre.status === "PENDING_REVIEW" ? "rgba(245,158,11,0.45)" : "var(--border-color)", color: genre.status === "PENDING_REVIEW" ? "#d97706" : "var(--text-main)" }}>{genre.genreName}</span>)}
                            {!movie.genres?.length && <span className="text-sm text-rose-600">No genre supplied.</span>}
                          </dd>
                        </div>
                        <div className="grid items-start gap-2 border-t py-3.5 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-6" style={{ borderColor: "var(--border-color)" }}>
                          <dt className="text-[13px] font-semibold leading-5" style={{ color: "var(--text-sub)" }}>Formats</dt>
                          <dd className="flex flex-wrap gap-1.5">
                            {movie.formats?.map((format) => <span key={format.formatId} className="rounded-md border px-2.5 py-1 text-[13px] font-medium leading-5" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>{format.formatCode}</span>)}
                            {!movie.formats?.length && <span className="text-sm text-rose-600">No screening format supplied.</span>}
                          </dd>
                        </div>
                      </dl>
                    </section>

                    <section className="border-t pt-7" style={{ borderColor: "var(--border-color)" }}>
                      <p className="text-[11px] font-bold uppercase leading-4 tracking-[0.09em] text-blue-600">Distribution metadata</p>
                      <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
                        <MetaRow icon={Clock} label="Runtime" value={formatDuration(movie.durationMinutes)} />
                        <MetaRow icon={Calendar} label="Release" value={formatDate(movie.releaseDate)} />
                        <MetaRow icon={Globe} label="Language" value={LANG_NAME[movie.originalLanguage] ?? movie.originalLanguage ?? "Not set"} />
                        <MetaRow icon={MapPin} label="Country" value={movie.country ?? "Not set"} />
                      </dl>
                    </section>

                    <details className="mt-6 rounded-xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                      <summary className="cursor-pointer px-4 py-3.5 text-[13px] font-semibold leading-5" style={{ color: "var(--text-main)" }}>Record details</summary>
                      <dl className="grid gap-x-8 border-t px-4 py-3 sm:grid-cols-2" style={{ borderColor: "var(--border-color)" }}>
                        <MetaRow icon={Film} label="Record ID" value={String(movie.movieId)} />
                        <MetaRow icon={History} label="Version" value={movie.version != null ? String(movie.version) : "Not recorded"} />
                        <MetaRow icon={UserRound} label="Created by" value={movie.createdBy || "Not recorded"} />
                        <MetaRow icon={UserRound} label="Last changed by" value={movie.updatedBy || "Not recorded"} />
                        <MetaRow icon={Calendar} label="Created" value={formatDateTime(movie.createdAt)} />
                        <MetaRow icon={Calendar} label="Last updated" value={formatDateTime(movie.updatedAt)} />
                        {movie.tmdbId && <MetaRow icon={ExternalLink} label="TMDB ID" value={String(movie.tmdbId)} />}
                        {movie.imdbId && <MetaRow icon={ExternalLink} label="IMDb ID" value={movie.imdbId} />}
                      </dl>
                    </details>
                  </div>
                )}

                {tab === "media" && mediaImages.length > 0 && (
                  <div className="space-y-4">
                    {/* Large swipeable viewer — every asset (poster + backdrops + stills). */}
                    <div
                      className="relative h-64 select-none overflow-hidden rounded-2xl border sm:h-80"
                      style={{
                        borderColor: "var(--border-color)", background: "var(--bg-card)", touchAction: "pan-y",
                        // Inline flex centering (not Tailwind's items-center/justify-center classes) so
                        // this doesn't depend on those utility classes being generated — the poster was
                        // previously rendering pinned to the right edge instead of centered.
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      onTouchStart={handleMediaTouchStart}
                      onTouchEnd={handleMediaTouchEnd}
                    >
                      {/* Sized via inline maxWidth/maxHeight (not Tailwind's max-w-full/max-h-full)
                          and centered by the flex container above, instead of `absolute inset-0` +
                          object-fit relying on the browser's default object-position. Shown uncropped
                          (objectFit: contain) for every asset type — object-cover on backdrops/stills
                          was cropping out meaningful content near the edges. */}
                      <img
                        key={mediaImages[mediaIdx]?.imageId}
                        src={mediaImages[mediaIdx]?.imageUrl}
                        alt={mediaImages[mediaIdx]?.caption ?? mediaImages[mediaIdx]?.imageType}
                        style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain", display: "block", margin: "0 auto" }}
                        className="animate-in fade-in duration-300"
                      />
                      <div className="absolute left-3 top-3 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}>
                        {mediaImages[mediaIdx]?.imageType}{mediaImages[mediaIdx]?.imageId === -1 ? undefined : ` · ${mediaIdx + 1}/${mediaImages.length}`}
                      </div>
                      {mediaImages.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setMediaIdx((i) => (i - 1 + mediaImages.length) % mediaImages.length)}
                            aria-label="Previous image"
                            className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
                            style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setMediaIdx((i) => (i + 1) % mediaImages.length)}
                            aria-label="Next image"
                            className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
                            style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
                          >
                            <ChevronRight size={18} />
                          </button>
                          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
                            {mediaImages.map((image, index) => (
                              <button
                                key={image.imageId}
                                type="button"
                                onClick={() => setMediaIdx(index)}
                                aria-label={`Go to image ${index + 1}`}
                                className="rounded-full transition-all"
                                style={{ width: index === mediaIdx ? "16px" : "6px", height: "6px", background: index === mediaIdx ? "#FFD700" : "rgba(255,255,255,0.6)" }}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Thumbnail strip — jump straight to any asset instead of stepping one at a time. */}
                    {mediaImages.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {mediaImages.map((image, index) => (
                          <button
                            key={image.imageId}
                            type="button"
                            onClick={() => setMediaIdx(index)}
                            className="relative flex-shrink-0 overflow-hidden rounded-lg border-2 transition-opacity"
                            style={{
                              borderColor: index === mediaIdx ? "#FFD700" : "var(--border-color)",
                              opacity: index === mediaIdx ? 1 : 0.65,
                              width: image.imageType === "POSTER" ? "48px" : "84px",
                              height: "56px",
                            }}
                          >
                            <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}

                    {isReview && (
                      <div className="flex flex-wrap gap-2.5">
                        {movie.trailerUrl && <a href={movie.trailerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-sm font-semibold text-blue-500" style={{ borderColor: "var(--border-color)" }}><Play size={14} />Watch trailer<ExternalLink size={12} /></a>}
                        {movie.tmdbId && <a href={`https://www.themoviedb.org/movie/${movie.tmdbId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>TMDB #{movie.tmdbId}<ExternalLink size={12} /></a>}
                        {movie.imdbId && <a href={`https://www.imdb.com/title/${movie.imdbId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>IMDb {movie.imdbId}<ExternalLink size={12} /></a>}
                      </div>
                    )}
                  </div>
                )}

                {tab === "media" && isReview && mediaImages.length === 0 && (
                  <section className="rounded-xl border border-dashed p-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>No reviewable assets</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>A primary poster is required before this submission can be approved.</p>
                  </section>
                )}

                {tab === "credits" && !isReview && (
                  <div className="space-y-4">
                    {directors.length > 0 && (
                      <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                        <SectionLabel icon={Users}>Director{directors.length > 1 ? "s" : ""}</SectionLabel>
                        <div className="flex flex-wrap gap-4">
                          {directors.map(d => (
                            <div key={d.personId} className="flex items-center gap-2.5">
                              {d.photoUrl ? (
                                <img src={d.photoUrl} alt={d.fullName} className="w-10 h-10 rounded-full object-cover border" style={{ borderColor: "var(--border-color)" }} />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border" style={{ borderColor: "var(--border-color)", fontSize: "12px", fontWeight: 700, color: "#2563eb" }}>
                                  {d.fullName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-main)" }}>{d.fullName}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {actors.length > 0 && (
                      <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                        <SectionLabel icon={Users}>Actors</SectionLabel>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {actors.map(a => (
                            <div key={a.personId} className="flex items-center gap-2.5 rounded-lg p-2.5 border" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                              {a.photoUrl ? (
                                <img src={a.photoUrl} alt={a.fullName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0" style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280" }}>
                                  {a.fullName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fullName}</p>
                                {a.characterName && (
                                  <p style={{ fontSize: "11.5px", color: "var(--text-sub)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>as {a.characterName}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}

                {tab === "media" && isReview && (
                  <section className="mt-4 rounded-2xl border p-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                    <SectionHeading icon={Users} title="Credits & rights metadata" description="Verify key creative credits and linked production companies." />
                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <p className="mb-3 text-[13px] font-semibold uppercase leading-5 tracking-wide" style={{ color: "var(--text-sub)" }}>Directors</p>
                        <div className="space-y-2.5">
                          {directors.map((director) => <div key={director.personId} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}><div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ background: "var(--bg-hover)", color: "var(--text-sub)" }}>{director.photoUrl ? <img src={director.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={18} />}</div><p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{director.fullName}</p></div>)}
                          {!directors.length && <p className="text-sm text-amber-600">Director not supplied.</p>}
                        </div>
                      </div>
                      <div>
                        <p className="mb-3 text-[13px] font-semibold uppercase leading-5 tracking-wide" style={{ color: "var(--text-sub)" }}>Production companies</p>
                        <div className="space-y-2.5">
                          {movie.companies?.map((company) => <div key={company.companyId} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}><div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ background: "var(--bg-hover)", color: "var(--text-sub)" }}>{company.logoUrl ? <img src={company.logoUrl} alt="" className="h-full w-full object-contain" /> : <Building2 size={18} />}</div><div className="min-w-0"><p className="truncate text-sm font-semibold" style={{ color: "var(--text-main)" }}>{company.name}</p><p className="text-xs" style={{ color: "var(--text-sub)" }}>{company.country || "Country not set"}</p></div></div>)}
                          {!movie.companies?.length && <p className="text-sm text-amber-600">Production company not supplied.</p>}
                        </div>
                      </div>
                    </div>
                    {actors.length > 0 && (
                      <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border-color)" }}>
                        <p className="mb-3 text-[13px] font-semibold uppercase leading-5 tracking-wide" style={{ color: "var(--text-sub)" }}>Principal cast · {actors.length}</p>
                        <div className="flex flex-wrap gap-2.5">
                          {actors.slice(0, 12).map((actor) => <span key={`${actor.personId}-${actor.characterName}`} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}><strong>{actor.fullName}</strong>{actor.characterName ? ` as ${actor.characterName}` : ""}</span>)}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {tab === "activity" && isReview && (
                  <section className="mx-auto w-full max-w-4xl">
                    <div className="mb-5">
                      <p className="text-[11px] font-bold uppercase leading-4 tracking-[0.09em] text-blue-600">Governance</p>
                      <h3 className="mt-1 text-[17px] font-bold leading-6" style={{ color: "var(--text-main)" }}>Content lifecycle activity</h3>
                      <p className="mt-1 text-xs leading-[18px]" style={{ color: "var(--text-sub)" }}>Status transitions, decision actors and recorded reasons for this catalog record.</p>
                    </div>

                    {historyLoading ? (
                      <div className="flex items-center justify-center gap-2 rounded-xl border py-10 text-sm" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}><Loader2 size={16} className="animate-spin" />Loading activity…</div>
                    ) : historyUnavailable ? (
                      <div className="rounded-xl border border-dashed p-5 text-sm" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>Activity history is temporarily unavailable. Review actions remain protected by the server workflow.</div>
                    ) : history.length ? (
                      <ol className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
                        {history.map((entry) => (
                          <li key={entry.historyId} className="grid gap-3 border-b px-4 py-4 last:border-b-0 sm:grid-cols-[36px_minmax(0,1fr)_auto]" style={{ borderColor: "var(--border-color)" }}>
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-600"><History size={15} /></span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                                {formatWorkflowStatus(entry.fromStatus)} → {formatWorkflowStatus(entry.toStatus)}
                              </p>
                              <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>by {entry.actor || "System"}</p>
                              {entry.reason && <p className="mt-2 rounded-lg px-3 py-2 text-xs leading-5" style={{ color: "var(--text-main)", background: "var(--bg-main)" }}>{entry.reason}</p>}
                            </div>
                            <time className="text-xs leading-[18px] sm:text-right" style={{ color: "var(--text-sub)" }}>{formatDateTime(entry.createdAt)}</time>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="rounded-xl border border-dashed p-5 text-sm" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>No lifecycle transitions have been recorded yet.</div>
                    )}
                  </section>
                )}

                </div>
                {isReview && (
                  <aside className="border-t p-6 lg:overflow-y-auto lg:border-l lg:border-t-0" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-bold leading-[22px]" style={{ color: "var(--text-main)" }}>Decision summary</p>
                        <p className="mt-1 text-xs leading-[18px]" style={{ color: "var(--text-sub)" }}>{passedCount}/{readinessChecks.length} required checks passed</p>
                      </div>
                      <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold leading-4" style={{ color: decisionReady ? "#047857" : "#dc2626", background: decisionReady ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.09)" }}>
                        {selfApproval ? "SOD BLOCK" : approvalReady ? "READY" : `${blockers.length} ISSUE${blockers.length > 1 ? "S" : ""}`}
                      </span>
                    </div>

                    {selfApproval && (
                      <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "rgba(220,38,38,0.28)", background: "rgba(220,38,38,0.06)" }}>
                        <p className="flex items-center gap-2 text-[13px] font-semibold leading-5 text-rose-700"><AlertTriangle size={14} />Independent approval required</p>
                        <p className="mt-1.5 text-xs leading-[18px]" style={{ color: "var(--text-sub)" }}>You created this record, so separation-of-duties policy prevents self-approval.</p>
                      </div>
                    )}

                    <div className="mt-5 border-y" style={{ borderColor: "var(--border-color)" }}>
                      {blockers.length > 0 ? blockers.map((check) => (
                        <div key={check.key} className="flex gap-2.5 border-b py-3 last:border-b-0" style={{ borderColor: "var(--border-color)" }}>
                          <XCircle size={16} className="mt-0.5 flex-shrink-0 text-rose-600" />
                          <div>
                            <p className="text-[13px] font-semibold leading-5" style={{ color: "var(--text-main)" }}>{check.label}</p>
                            <p className="mt-1 text-xs leading-[18px]" style={{ color: "var(--text-sub)" }}>{check.detail}</p>
                          </div>
                        </div>
                      )) : (
                        <div className="flex gap-2.5 py-4">
                          <CheckCircle2 size={17} className="flex-shrink-0 text-emerald-600" />
                          <p className="text-[13px] font-semibold leading-5 text-emerald-700">Ready for content approval</p>
                        </div>
                      )}
                    </div>

                    {passedChecks.length > 0 && (
                      <div className="mt-4">
                        <button type="button" aria-expanded={showPassedChecks} onClick={() => setShowPassedChecks((current) => !current)} className="flex w-full items-center justify-between gap-3 py-1 text-left">
                          <span className="text-[13px] font-semibold leading-5" style={{ color: "var(--text-main)" }}>Passed checks <span style={{ color: "var(--text-sub)" }}>({passedChecks.length})</span></span>
                          <ChevronDown size={15} className={`transition-transform ${showPassedChecks ? "rotate-180" : ""}`} style={{ color: "var(--text-sub)" }} />
                        </button>
                        {showPassedChecks && (
                          <ul className="mt-2 space-y-2">
                            {passedChecks.map((check) => <li key={check.key} className="flex items-start gap-2 text-xs leading-[18px]" style={{ color: "var(--text-sub)" }}><Check size={13} className="mt-0.5 flex-shrink-0 text-emerald-600" />{check.label}</li>)}
                          </ul>
                        )}
                      </div>
                    )}

                    {warnings.length > 0 && (
                      <details className="mt-5">
                        <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold leading-5 text-amber-600"><AlertTriangle size={14} />{warnings.length} non-blocking observation{warnings.length > 1 ? "s" : ""}</summary>
                        <ul className="mt-2 space-y-2 pl-5 text-xs leading-[18px]" style={{ color: "var(--text-sub)" }}>
                          {warnings.map((warning) => <li key={warning} className="list-disc">{warning}</li>)}
                        </ul>
                      </details>
                    )}
                    <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                      <p className="text-[11px] font-bold uppercase leading-4 tracking-[0.08em]" style={{ color: "var(--text-sub)" }}>Decision scope</p>
                      <p className="mt-2 text-xs leading-[18px]" style={{ color: "var(--text-sub)" }}>Approval validates this catalog submission only. It does not publish the movie, activate a release plan or open ticket sales.</p>
                    </div>
                  </aside>
                )}
              </main>
            </div>
          </div>
        )}

        {/* Footer only exists in review mode (approve/reject actions). View mode closes via
            the header's X only — a footer there only duplicated that affordance. */}
        {isReview && (
          <footer className="flex-shrink-0 border-t px-5 py-4 sm:px-6 lg:px-7" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            {showRejectForm && (
              <div className="mb-4 rounded-xl border p-4" style={{ borderColor: noteTooShort ? "rgba(220,38,38,0.5)" : "var(--border-color)", background: "var(--bg-main)" }}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="review-change-note" className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>What must the editor change?</label>
                  <span className="text-xs" style={{ color: noteTooShort ? "#dc2626" : "var(--text-sub)" }}>{note.trim().length}/{MIN_NOTE_LENGTH} minimum</span>
                </div>
                <textarea
                  id="review-change-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Example: Add the Vietnamese synopsis and replace the low-resolution poster."
                  rows={2}
                  autoFocus
                  disabled={submitting === "reject"}
                  className="w-full resize-none rounded-lg border bg-transparent px-3.5 py-2.5 text-sm leading-6 outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
                  style={{ borderColor: noteTooShort ? "#dc2626" : "var(--border-color)", color: "var(--text-main)" }}
                />
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {!showRejectForm && (
                <p className="text-[13px] leading-5" style={{ color: decisionReady ? "#047857" : "var(--text-sub)" }}>
                  {selfApproval ? "Independent approval is required for this submission." : approvalReady ? "All required checks passed." : `${blockers.length} required issue${blockers.length > 1 ? "s" : ""} must be resolved before approval.`}
                </p>
              )}
              <div className="flex items-center justify-end gap-2.5 sm:ml-auto">
                {showRejectForm && <button type="button" onClick={() => { setShowRejectForm(false); setNote(""); }} disabled={submitting === "reject"} className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-40" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>Cancel</button>}
                {can.requestChanges && <button type="button" onClick={showRejectForm ? handleReject : () => setShowRejectForm(true)} disabled={Boolean(submitting) || loading || !movie || (showRejectForm && note.trim().length < MIN_NOTE_LENGTH)} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40" style={{ color: "#dc2626", borderColor: "rgba(220,38,38,0.45)", background: "rgba(220,38,38,0.04)" }}>{submitting === "reject" ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}{showRejectForm ? "Send change request" : "Request changes"}</button>}
                {can.approve && !showRejectForm && <button type="button" onClick={handleApprove} disabled={Boolean(submitting) || loading || !movie || !decisionReady} title={selfApproval ? "Separation-of-duties policy prevents self-approval" : !approvalReady ? "Resolve required review issues before approval" : undefined} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{submitting === "approve" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}Approve submission</button>}
              </div>
            </div>
          </footer>
        )}
      </section>
    </div>,
    portalRoot
  );
}
