import {
  X, Film, Tag, Globe, Users, Clock, Calendar, MapPin,
  Building2, ExternalLink, Play, ShieldCheck, Loader2, ChevronLeft, ChevronRight, Image as ImageIcon,
  AlertTriangle, Check, CheckCircle2, Globe2, Languages, UserRound, XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { MovieResponse } from "../api/movieApi";
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

type TabKey = "overview" | "media" | "credits" | "readiness";

type ReviewCheck = {
  key: string;
  label: string;
  detail: string;
  passed: boolean;
};

const MIN_NOTE_LENGTH = 10;

const LANG_NAME: Record<string, string> = {
  en: "English", vi: "Tiếng Việt", ja: "日本語", ko: "한국어",
  zh: "中文", fr: "Français", th: "ภาษาไทย",
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
  fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.07em",
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
        <h3 className="text-base font-bold" style={{ color: "var(--text-main)" }}>{title}</h3>
        {description && <p className="mt-0.5 text-xs" style={{ color: "var(--text-sub)" }}>{description}</p>}
      </div>
    </div>
  );
}

function ReviewItem({ item }: { item: ReviewCheck }) {
  return (
    <div className="flex gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
      <div
        className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
        style={{ color: item.passed ? "#059669" : "#dc2626", background: item.passed ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)" }}
      >
        {item.passed ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{item.label}</p>
        <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-sub)" }}>{item.detail}</p>
      </div>
    </div>
  );
}

/** Metadata row for the fixed left-hand poster rail — icon+label left, value right. No
 *  truncate on the value — long values (e.g. multi-country releases) wrap onto a second
 *  line instead of being cut off. The rail now leads with a small poster thumbnail rather
 *  than a full-width poster, which frees enough height for this single-column list to fit
 *  without needing a 2-up grid (grid read as uneven once values wrapped differently). */
function MetaRow({ icon: Icon, label, value }: { icon: typeof Film; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="flex flex-shrink-0 items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-sub)" }}>
        <Icon size={12} />{label}
      </span>
      <span className="text-right text-xs font-semibold leading-snug" style={{ color: "var(--text-main)" }}>{value}</span>
    </div>
  );
}

export function MovieDetailModal(props: Props) {
  const { open, movie, loading, onClose } = props;
  const mode = props.mode ?? "view";
  const isReview = mode === "review";
  const reviewProps = props.mode === "review" ? props : null;
  const { can } = useRole();

  const [synopsisLang, setSynopsisLang] = useState<"vi" | "en">("vi");
  const [mediaIdx, setMediaIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const mediaTouchStartX = useRef<number | null>(null);

  const handleClose = () => {
    if (isReview && submitting) return;
    setShowRejectForm(false);
    setNote("");
    onClose();
  };

  // Modal is portaled to document.body, outside the AdminLayout DOM subtree that carries
  // the .theme-dark/.theme-light class — without re-applying it here, var(--bg-card) and
  // friends fall back to :root's light-mode values regardless of the site's actual theme.
  const [portalThemeClass, setPortalThemeClass] = useState<"theme-dark" | "theme-light">("theme-light");
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    setPortalThemeClass(document.querySelector(".theme-dark") ? "theme-dark" : "theme-light");
  }, [open]);

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
    setNote("");
  }, [movie?.movieId, open]);

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
  const primarySynopsis = vi?.synopsis || en?.synopsis || movie?.synopsis || "";

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
  const passedCount = readinessChecks.length - blockers.length;

  const tabs = useMemo(() => {
    const list: Array<{ key: TabKey; label: string; show: boolean }> = [
      { key: "overview", label: "Overview", show: true },
      { key: "media", label: "Media", show: mediaImages.length > 0 },
      { key: "credits", label: isReview ? "Credits" : "Cast & Crew", show: isReview || directors.length > 0 || actors.length > 0 },
    ];
    if (isReview) {
      list.push({ key: "readiness", label: "Readiness", show: true });
    }
    return list.filter((t) => t.show);
  }, [isReview, mediaImages.length, directors.length, actors.length]);

  const tab = tabs.some(t => t.key === activeTab) ? activeTab : "overview";

  const dims = isReview
    ? {
        shell: "h-[min(92vh,880px)] max-w-6xl",
        asideW: "lg:w-[300px]",
        asideGap: "gap-5",
        asidePad: "p-5 lg:p-6",
        headerPad: "py-4",
        tabPad: "px-4 py-4",
        mainPad: "p-5 sm:p-6",
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
    if (!movie || !approvalReady || !reviewProps) return;
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

  return createPortal(
    <div className={`fixed inset-0 flex items-center justify-center p-3 sm:p-5 ${portalThemeClass}`} style={{ zIndex: 1000, isolation: "isolate" }}>
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-[3px]" onClick={handleClose} />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="movie-detail-title"
        className={`relative flex w-full flex-col overflow-hidden rounded-2xl border shadow-2xl ${dims.shell}`}
        style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", zIndex: 1001 }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* ── Header ── */}
        <header className={`flex flex-shrink-0 items-center justify-between gap-4 border-b px-5 sm:px-6 ${dims.headerPad}`} style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <div className="flex min-w-0 items-center gap-3">
            {isReview ? (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><ShieldCheck size={20} /></div>
            ) : (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><Film size={20} /></div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="movie-detail-title" className="truncate text-lg font-bold" style={{ color: "var(--text-main)" }}>
                  {isReview ? "Content approval review" : "Movie details"}
                </h2>
                {isReview && <span className="hidden rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-600 sm:inline-flex">Pending review</span>}
              </div>
              <p className="mt-0.5 truncate text-sm" style={{ color: "var(--text-sub)" }}>
                {isReview ? "Review catalog content before approval." : "Full catalog record — read-only preview."}
              </p>
            </div>
          </div>
          <button type="button" onClick={handleClose} disabled={isReview && Boolean(submitting)} aria-label="Close" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5" style={{ color: "var(--text-sub)" }}><X size={20} /></button>
        </header>

        {loading || !movie ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3" style={{ color: "var(--text-sub)" }}>
            <Loader2 size={28} className="animate-spin" />
            <p style={{ fontSize: "14px" }}>Loading movie {isReview ? "record" : "details"}…</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* ── Fixed left rail: poster + identity + at-a-glance meta, stays put across every tab ── */}
            <aside
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
                  <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ color: status.dot, background: `${status.dot}26`, border: `1px solid ${status.dot}40` }}>
                    {status.label}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--text-sub)" }}>#{movie.movieId}</span>
                  {movie.ageRating && (
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

              {movie.genres?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {movie.genres.map(g => (
                    <span key={g.genreId} className="rounded-md border px-2 py-1 text-[11px] font-medium" style={{ background: "var(--bg-main)", color: "var(--text-sub)", borderColor: "var(--border-color)" }}>
                      {g.genreName}
                    </span>
                  ))}
                </div>
              )}

              {isReview && (
                <button
                  type="button"
                  onClick={() => setActiveTab("readiness")}
                  className="flex items-center gap-3 rounded-xl border p-4 text-left transition-opacity hover:opacity-90"
                  style={{ borderColor: approvalReady ? "rgba(5,150,105,0.3)" : "rgba(220,38,38,0.3)", background: approvalReady ? "rgba(5,150,105,0.08)" : "rgba(220,38,38,0.08)" }}
                >
                  {approvalReady ? <CheckCircle2 size={22} className="flex-shrink-0 text-emerald-600" /> : <XCircle size={22} className="flex-shrink-0 text-rose-600" />}
                  <span className="min-w-0">
                    <span className="block text-sm font-bold" style={{ color: approvalReady ? "#059669" : "#dc2626" }}>
                      {approvalReady ? "Ready for approval" : `${blockers.length} blocking issue${blockers.length > 1 ? "s" : ""}`}
                    </span>
                    <span className="mt-0.5 block text-xs" style={{ color: "var(--text-sub)" }}>{passedCount}/{readinessChecks.length} checks passed — view details</span>
                  </span>
                </button>
              )}
            </aside>

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
                    {t.key === "readiness" && blockers.length > 0 && <span className="ml-1.5 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-600">{blockers.length}</span>}
                    {tab === t.key && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-600" />}
                  </button>
                ))}
              </nav>

              <main className={`nice-scrollbar min-h-0 flex-1 overflow-y-auto ${dims.mainPad}`}>
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
                  <div className="space-y-5">
                    <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                      <SectionHeading icon={Globe2} title="Customer-facing content" description="Check the title and synopsis customers will see." />
                      {(vi?.tagline || en?.tagline || movie.tagline) && <p className="text-sm italic" style={{ color: "var(--text-sub)" }}>“{vi?.tagline || en?.tagline || movie.tagline}”</p>}
                      <p className="mt-3 text-sm leading-6" style={{ color: primarySynopsis ? "var(--text-main)" : "#dc2626" }}>{primarySynopsis || "Synopsis has not been supplied."}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {movie.translations?.map((translation) => <span key={translation.languageCode} className="rounded-md border px-2.5 py-1 text-xs font-semibold uppercase" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>{translation.languageCode}</span>)}
                      </div>
                    </section>

                    <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                      <SectionHeading icon={Film} title="Classification & formats" />
                      <div className="flex flex-wrap gap-2">
                        {movie.ageRating && <span className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-500">{movie.ageRating.ratingCode}</span>}
                        {movie.genres?.map((genre) => <span key={genre.genreId} className="rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: genre.status === "PENDING_REVIEW" ? "#f59e0b" : "var(--border-color)", color: genre.status === "PENDING_REVIEW" ? "#d97706" : "var(--text-main)" }}>{genre.genreName}</span>)}
                        {movie.formats?.map((format) => <span key={format.formatId} className="rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>{format.formatCode}</span>)}
                      </div>
                    </section>

                    {blockers.length > 0 && (
                      <section className="rounded-2xl border p-5" style={{ borderColor: "rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.05)" }}>
                        <SectionHeading icon={ShieldCheck} title="Blocking issues" description="Resolve these before this title can be approved." />
                        <ul className="space-y-2">
                          {blockers.map((item) => <li key={item.key} className="flex gap-2.5 text-sm" style={{ color: "var(--text-main)" }}><span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-500" />{item.label}</li>)}
                        </ul>
                      </section>
                    )}
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

                {tab === "credits" && isReview && (
                  <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                    <SectionHeading icon={Users} title="Credits & rights metadata" description="Verify key creative credits and linked production companies." />
                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Directors</p>
                        <div className="space-y-2.5">
                          {directors.map((director) => <div key={director.personId} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}><div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ background: "var(--bg-hover)", color: "var(--text-sub)" }}>{director.photoUrl ? <img src={director.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={18} />}</div><p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{director.fullName}</p></div>)}
                          {!directors.length && <p className="text-sm text-amber-600">Director not supplied.</p>}
                        </div>
                      </div>
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Production companies</p>
                        <div className="space-y-2.5">
                          {movie.companies?.map((company) => <div key={company.companyId} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}><div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ background: "var(--bg-hover)", color: "var(--text-sub)" }}>{company.logoUrl ? <img src={company.logoUrl} alt="" className="h-full w-full object-contain" /> : <Building2 size={18} />}</div><div className="min-w-0"><p className="truncate text-sm font-semibold" style={{ color: "var(--text-main)" }}>{company.name}</p><p className="text-xs" style={{ color: "var(--text-sub)" }}>{company.country || "Country not set"}</p></div></div>)}
                          {!movie.companies?.length && <p className="text-sm text-amber-600">Production company not supplied.</p>}
                        </div>
                      </div>
                    </div>
                    {actors.length > 0 && (
                      <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border-color)" }}>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Principal cast · {actors.length}</p>
                        <div className="flex flex-wrap gap-2.5">
                          {actors.slice(0, 12).map((actor) => <span key={`${actor.personId}-${actor.characterName}`} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}><strong>{actor.fullName}</strong>{actor.characterName ? ` as ${actor.characterName}` : ""}</span>)}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {tab === "readiness" && isReview && (
                  <div className="space-y-5">
                    <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <SectionHeading icon={ShieldCheck} title="Approval readiness" description="The backend validator remains authoritative." />
                        <span className="flex-shrink-0 rounded-xl px-3 py-2 text-sm font-black" style={{ color: approvalReady ? "#059669" : "#dc2626", background: approvalReady ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)" }}>{passedCount}/{readinessChecks.length}</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">{readinessChecks.map((check) => <ReviewItem key={check.key} item={check} />)}</div>
                    </section>

                    {warnings.length > 0 && (
                      <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                        <div className="mb-3 flex items-center gap-2"><AlertTriangle size={15} className="text-amber-500" /><p className="text-xs font-bold uppercase tracking-wide text-amber-600">Observations</p></div>
                        <ul className="space-y-2">{warnings.map((warning) => <li key={warning} className="flex gap-2.5 text-sm leading-5" style={{ color: "var(--text-sub)" }}><span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />{warning}</li>)}</ul>
                      </section>
                    )}

                    <p className="text-xs" style={{ color: "var(--text-sub)" }}>Approval validates catalog content only; it does not publish the movie or open sales.</p>
                  </div>
                )}

              </main>
            </div>
          </div>
        )}

        {/* Footer only exists in review mode (approve/reject actions). View mode closes via
            the header's X only — a footer there only duplicated that affordance. */}
        {isReview && (
          <footer className="flex-shrink-0 border-t px-5 py-4 sm:px-6" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
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
            <div className="flex items-center justify-end gap-2.5">
              {showRejectForm && <button type="button" onClick={() => { setShowRejectForm(false); setNote(""); }} disabled={submitting === "reject"} className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-40" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>Cancel</button>}
              {can.requestChanges && <button type="button" onClick={showRejectForm ? handleReject : () => setShowRejectForm(true)} disabled={Boolean(submitting) || loading || !movie || (showRejectForm && note.trim().length < MIN_NOTE_LENGTH)} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40" style={{ color: "#dc2626", borderColor: "rgba(220,38,38,0.45)", background: "rgba(220,38,38,0.04)" }}>{submitting === "reject" ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}{showRejectForm ? "Send change request" : "Request changes"}</button>}
              {can.approve && !showRejectForm && <button type="button" onClick={handleApprove} disabled={Boolean(submitting) || loading || !approvalReady} title={!approvalReady ? "Resolve all blocking readiness issues before approval" : undefined} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{submitting === "approve" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}Approve content</button>}
            </div>
          </footer>
        )}
      </section>
    </div>,
    document.body
  );
}
