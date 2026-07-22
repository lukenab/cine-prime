import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  Globe2,
  Image as ImageIcon,
  Languages,
  Loader2,
  MapPin,
  Play,
  ShieldCheck,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { MovieResponse } from "../api/movieApi";
import { useRole } from "../hooks/useRole";

type Props = {
  open: boolean;
  movie: MovieResponse | null;
  loading?: boolean;
  onClose: () => void;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number, note: string) => Promise<void>;
};

type ReviewCheck = {
  key: string;
  label: string;
  detail: string;
  passed: boolean;
};

type ReviewTab = "overview" | "media" | "credits" | "readiness";

const MIN_NOTE_LENGTH = 10;

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

const tabs: Array<{ id: ReviewTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "media", label: "Media" },
  { id: "credits", label: "Credits" },
  { id: "readiness", label: "Readiness" },
];

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

function SectionHeading({ icon: Icon, title, description }: {
  icon: typeof Film;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--bg-hover)", color: "var(--text-sub)" }}>
        <Icon size={14} />
      </div>
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{title}</h3>
        {description && <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-sub)" }}>{description}</p>}
      </div>
    </div>
  );
}

function ReviewItem({ item }: { item: ReviewCheck }) {
  return (
    <div className="flex gap-2.5 rounded-xl border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
      <div
        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
        style={{ color: item.passed ? "#059669" : "#dc2626", background: item.passed ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)" }}
      >
        {item.passed ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={{ color: "var(--text-main)" }}>{item.label}</p>
        <p className="mt-0.5 text-[11px] leading-4" style={{ color: "var(--text-sub)" }}>{item.detail}</p>
      </div>
    </div>
  );
}

function MetaItem({ icon: Icon, label, value }: { icon: typeof Film; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}><Icon size={11} />{label}</p>
      <p className="mt-1 truncate text-xs font-semibold" style={{ color: "var(--text-main)" }}>{value}</p>
    </div>
  );
}

export function PendingReviewModal({ open, movie, loading, onClose, onApprove, onReject }: Props) {
  const { can } = useRole();
  const [activeTab, setActiveTab] = useState<ReviewTab>("overview");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    if (!open) return;
    setActiveTab("overview");
    setShowRejectForm(false);
    setNote("");
  }, [open, movie?.movieId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, submitting, onClose]);

  const vi = movie?.translations?.find((translation) => translation.languageCode === "vi");
  const en = movie?.translations?.find((translation) => translation.languageCode === "en");
  const displayTitle = vi?.title || en?.title || movie?.originalTitle || "Untitled movie";
  const primarySynopsis = vi?.synopsis || en?.synopsis || movie?.synopsis || "";
  const directors = movie?.cast?.filter((credit) => credit.roleType === "DIRECTOR") ?? [];
  const actors = movie?.cast?.filter((credit) => credit.roleType === "ACTOR") ?? [];
  const images = movie?.images ?? [];
  const poster = images.find((image) => image.imageType === "POSTER" && image.isDefault)
    ?? images.find((image) => image.imageType === "POSTER");
  const posterUrl = poster?.imageUrl || movie?.posterUrl;

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
  // AdminLayout scopes its CSS variables under .theme-dark/.theme-light. Because this
  // dialog is portaled to document.body to escape header/sidebar stacking contexts, it
  // must carry the active theme class with it instead of relying on DOM inheritance.
  const portalThemeClass = typeof document !== "undefined" && document.querySelector(".theme-dark")
    ? "theme-dark"
    : "theme-light";

  const resetAndClose = () => {
    if (submitting) return;
    setShowRejectForm(false);
    setNote("");
    onClose();
  };

  const handleApprove = async () => {
    if (!movie || !approvalReady) return;
    setSubmitting("approve");
    try {
      await onApprove(movie.movieId);
      toast.success(`"${movie.originalTitle}" approved.`);
      onClose();
    } catch (err: any) {
      toast.error(approvalErrorMessage(err));
    } finally {
      setSubmitting(null);
    }
  };

  const handleReject = async () => {
    if (!movie || note.trim().length < MIN_NOTE_LENGTH) return;
    setSubmitting("reject");
    try {
      await onReject(movie.movieId, note.trim());
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
      <button type="button" aria-label="Close review" className="absolute inset-0 cursor-default bg-slate-950/75 backdrop-blur-[3px]" onClick={resetAndClose} />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="movie-review-title"
        className="relative flex h-[min(88vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{ background: "var(--bg-main)", borderColor: "var(--border-color)", zIndex: 1001 }}
      >
        <header className="flex flex-shrink-0 items-center justify-between gap-4 border-b px-4 py-3 sm:px-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><ShieldCheck size={18} /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="movie-review-title" className="truncate text-base font-bold" style={{ color: "var(--text-main)" }}>Content approval review</h2>
                <span className="hidden rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 sm:inline-flex">Pending review</span>
              </div>
              <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-sub)" }}>Review catalog content before approval.</p>
            </div>
          </div>
          <button type="button" onClick={resetAndClose} disabled={Boolean(submitting)} aria-label="Close" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5" style={{ color: "var(--text-sub)" }}><X size={18} /></button>
        </header>

        {loading || !movie ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3" style={{ color: "var(--text-sub)" }}><Loader2 size={28} className="animate-spin" /><p className="text-sm">Loading movie record...</p></div>
        ) : (
          <>
            <div className="flex flex-shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
              <div className="h-16 w-11 flex-shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: "var(--border-color)", background: "var(--bg-hover)" }}>
                {posterUrl ? <img src={posterUrl} alt={movie.originalTitle} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center" style={{ color: "var(--text-sub)" }}><ImageIcon size={16} /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-500">Movie #{movie.movieId}</p>
                <h3 className="truncate text-lg font-bold" style={{ color: "var(--text-main)" }}>{displayTitle}</h3>
                <p className="truncate text-xs" style={{ color: "var(--text-sub)" }}>{movie.originalTitle} · {formatDuration(movie.durationMinutes)} · {movie.releaseDate ? formatDate(movie.releaseDate) : "Release date not set"}</p>
              </div>
              <button type="button" onClick={() => setActiveTab("readiness")} className="hidden flex-shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold sm:flex" style={{ borderColor: approvalReady ? "rgba(5,150,105,0.3)" : "rgba(220,38,38,0.3)", color: approvalReady ? "#059669" : "#dc2626", background: approvalReady ? "rgba(5,150,105,0.06)" : "rgba(220,38,38,0.06)" }}>
                {approvalReady ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                {passedCount}/{readinessChecks.length}{blockers.length ? ` · ${blockers.length} blocker${blockers.length > 1 ? "s" : ""}` : " · Ready"}
              </button>
            </div>

            <nav className="flex flex-shrink-0 gap-1 overflow-x-auto border-b px-4 sm:px-5" aria-label="Review sections" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
              {tabs.map((tab) => (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className="relative whitespace-nowrap px-3 py-3 text-xs font-semibold transition-colors" style={{ color: activeTab === tab.id ? "#2563eb" : "var(--text-sub)" }}>
                  {tab.label}{tab.id === "readiness" && blockers.length > 0 && <span className="ml-1.5 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[9px] text-rose-600">{blockers.length}</span>}
                  {activeTab === tab.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-600" />}
                </button>
              ))}
            </nav>

            <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {activeTab === "overview" && (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
                  <div className="space-y-4">
                    <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                      <SectionHeading icon={Globe2} title="Customer-facing content" description="Check the title and synopsis customers will see." />
                      <h4 className="text-base font-bold" style={{ color: "var(--text-main)" }}>{displayTitle}</h4>
                      {(vi?.tagline || en?.tagline || movie.tagline) && <p className="mt-1 text-xs italic" style={{ color: "var(--text-sub)" }}>“{vi?.tagline || en?.tagline || movie.tagline}”</p>}
                      <p className="mt-3 line-clamp-6 text-xs leading-5" style={{ color: primarySynopsis ? "var(--text-main)" : "#dc2626" }}>{primarySynopsis || "Synopsis has not been supplied."}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {movie.translations?.map((translation) => <span key={translation.languageCode} className="rounded-md border px-2 py-1 text-[10px] font-semibold uppercase" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>{translation.languageCode}</span>)}
                      </div>
                    </section>

                    <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                      <SectionHeading icon={Film} title="Classification & formats" />
                      <div className="flex flex-wrap gap-2">
                        {movie.ageRating && <span className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-500">{movie.ageRating.ratingCode}</span>}
                        {movie.genres?.map((genre) => <span key={genre.genreId} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: genre.status === "PENDING_REVIEW" ? "#f59e0b" : "var(--border-color)", color: genre.status === "PENDING_REVIEW" ? "#d97706" : "var(--text-main)" }}>{genre.genreName}</span>)}
                        {movie.formats?.map((format) => <span key={format.formatId} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>{format.formatCode}</span>)}
                      </div>
                    </section>
                  </div>

                  <aside className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                    <SectionHeading icon={ShieldCheck} title="Review summary" description="Only blockers prevent approval." />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                      <MetaItem icon={Clock} label="Runtime" value={formatDuration(movie.durationMinutes)} />
                      <MetaItem icon={Calendar} label="Release" value={formatDate(movie.releaseDate)} />
                      <MetaItem icon={Languages} label="Language" value={movie.originalLanguage?.toUpperCase() || "Not set"} />
                      <MetaItem icon={MapPin} label="Country" value={movie.country || "Not set"} />
                    </div>
                    <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                      <p className="text-xs font-bold" style={{ color: approvalReady ? "#059669" : "#dc2626" }}>{approvalReady ? "Ready for approval" : `${blockers.length} blocking issue${blockers.length > 1 ? "s" : ""}`}</p>
                      {blockers.length > 0 && <ul className="mt-2 space-y-1.5">{blockers.slice(0, 4).map((item) => <li key={item.key} className="flex gap-2 text-[11px]" style={{ color: "var(--text-sub)" }}><span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-rose-500" />{item.label}</li>)}</ul>}
                      <button type="button" onClick={() => setActiveTab("readiness")} className="mt-3 text-[11px] font-semibold text-blue-500">View readiness details →</button>
                    </div>
                  </aside>
                </div>
              )}

              {activeTab === "media" && (
                <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                  <SectionHeading icon={ImageIcon} title="Media evidence" description="Review selected customer-facing artwork and trailer." />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {images.slice(0, 12).map((image) => <figure key={image.imageId} className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}><img src={image.imageUrl} alt={image.caption || image.imageType} className="h-32 w-full object-cover" /><figcaption className="flex items-center justify-between gap-1 px-2 py-1.5"><span className="truncate text-[9px] font-bold uppercase" style={{ color: "var(--text-sub)" }}>{image.imageType}</span>{image.isDefault && <span className="text-[9px] text-blue-500">Primary</span>}</figcaption></figure>)}
                    {!images.length && posterUrl && <figure className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}><img src={posterUrl} alt="Primary poster" className="h-32 w-full object-cover" /><figcaption className="px-2 py-1.5 text-[9px] font-bold uppercase" style={{ color: "var(--text-sub)" }}>Primary poster</figcaption></figure>}
                    {!images.length && !posterUrl && <div className="col-span-full flex h-28 items-center justify-center rounded-xl border border-dashed text-xs text-rose-500">No media has been attached.</div>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {movie.trailerUrl && <a href={movie.trailerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-blue-500" style={{ borderColor: "var(--border-color)" }}><Play size={13} />Watch trailer<ExternalLink size={11} /></a>}
                    {movie.tmdbId && <a href={`https://www.themoviedb.org/movie/${movie.tmdbId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>TMDB #{movie.tmdbId}<ExternalLink size={11} /></a>}
                    {movie.imdbId && <a href={`https://www.imdb.com/title/${movie.imdbId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>IMDb {movie.imdbId}<ExternalLink size={11} /></a>}
                  </div>
                </section>
              )}

              {activeTab === "credits" && (
                <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                  <SectionHeading icon={Users} title="Credits & rights metadata" description="Verify key creative credits and linked production companies." />
                  <div className="grid gap-6 md:grid-cols-2">
                    <div><p className="mb-3 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Directors</p><div className="space-y-2">{directors.map((director) => <div key={director.personId} className="flex items-center gap-2.5 rounded-xl border p-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full" style={{ background: "var(--bg-hover)", color: "var(--text-sub)" }}>{director.photoUrl ? <img src={director.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={15} />}</div><p className="text-xs font-semibold" style={{ color: "var(--text-main)" }}>{director.fullName}</p></div>)}{!directors.length && <p className="text-xs text-amber-600">Director not supplied.</p>}</div></div>
                    <div><p className="mb-3 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Production companies</p><div className="space-y-2">{movie.companies?.map((company) => <div key={company.companyId} className="flex items-center gap-2.5 rounded-xl border p-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg" style={{ background: "var(--bg-hover)", color: "var(--text-sub)" }}>{company.logoUrl ? <img src={company.logoUrl} alt="" className="h-full w-full object-contain" /> : <Building2 size={15} />}</div><div><p className="text-xs font-semibold" style={{ color: "var(--text-main)" }}>{company.name}</p><p className="text-[10px]" style={{ color: "var(--text-sub)" }}>{company.country || "Country not set"}</p></div></div>)}{!movie.companies?.length && <p className="text-xs text-amber-600">Production company not supplied.</p>}</div></div>
                  </div>
                  {actors.length > 0 && <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border-color)" }}><p className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Principal cast · {actors.length}</p><div className="flex flex-wrap gap-2">{actors.slice(0, 12).map((actor) => <span key={`${actor.personId}-${actor.characterName}`} className="rounded-lg border px-2.5 py-1.5 text-[11px]" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}><strong>{actor.fullName}</strong>{actor.characterName ? ` as ${actor.characterName}` : ""}</span>)}</div></div>}
                </section>
              )}

              {activeTab === "readiness" && (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                    <div className="mb-4 flex items-start justify-between gap-3"><SectionHeading icon={ShieldCheck} title="Approval readiness" description="The backend validator remains authoritative." /><span className="rounded-xl px-2.5 py-1.5 text-xs font-black" style={{ color: approvalReady ? "#059669" : "#dc2626", background: approvalReady ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)" }}>{passedCount}/{readinessChecks.length}</span></div>
                    <div className="grid gap-2 sm:grid-cols-2">{readinessChecks.map((check) => <ReviewItem key={check.key} item={check} />)}</div>
                  </section>
                  <aside className="space-y-4">
                    <div className="rounded-2xl border p-4" style={{ borderColor: approvalReady ? "rgba(5,150,105,0.25)" : "rgba(220,38,38,0.25)", background: approvalReady ? "rgba(5,150,105,0.06)" : "rgba(220,38,38,0.06)" }}><div className="flex gap-2">{approvalReady ? <CheckCircle2 size={16} className="mt-0.5 text-emerald-600" /> : <XCircle size={16} className="mt-0.5 text-rose-600" />}<div><p className="text-xs font-bold" style={{ color: approvalReady ? "#059669" : "#dc2626" }}>{approvalReady ? "Ready for approval" : `${blockers.length} blocking issue${blockers.length > 1 ? "s" : ""}`}</p><p className="mt-1 text-[11px] leading-4" style={{ color: "var(--text-sub)" }}>Approval validates catalog content only; it does not publish the movie or open sales.</p></div></div></div>
                    {warnings.length > 0 && <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}><div className="mb-2 flex items-center gap-1.5"><AlertTriangle size={13} className="text-amber-500" /><p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Observations</p></div><ul className="space-y-1.5">{warnings.map((warning) => <li key={warning} className="flex gap-2 text-[11px] leading-4" style={{ color: "var(--text-sub)" }}><span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-amber-500" />{warning}</li>)}</ul></div>}
                  </aside>
                </div>
              )}
            </main>
          </>
        )}

        <footer className="flex-shrink-0 border-t px-4 py-3 sm:px-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          {showRejectForm && <div className="mb-3 rounded-xl border p-3" style={{ borderColor: noteTooShort ? "rgba(220,38,38,0.5)" : "var(--border-color)", background: "var(--bg-main)" }}><div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="review-change-note" className="text-xs font-semibold" style={{ color: "var(--text-main)" }}>What must the editor change?</label><span className="text-[10px]" style={{ color: noteTooShort ? "#dc2626" : "var(--text-sub)" }}>{note.trim().length}/{MIN_NOTE_LENGTH} minimum</span></div><textarea id="review-change-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Example: Add the Vietnamese synopsis and replace the low-resolution poster." rows={2} autoFocus disabled={submitting === "reject"} className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-xs leading-5 outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60" style={{ borderColor: noteTooShort ? "#dc2626" : "var(--border-color)", color: "var(--text-main)" }} /></div>}
          <div className="flex items-center justify-end gap-2">
            {showRejectForm && <button type="button" onClick={() => { setShowRejectForm(false); setNote(""); }} disabled={submitting === "reject"} className="rounded-xl border px-4 py-2.5 text-xs font-semibold disabled:opacity-40" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>Cancel</button>}
            {can.requestChanges && <button type="button" onClick={showRejectForm ? handleReject : () => setShowRejectForm(true)} disabled={Boolean(submitting) || loading || !movie || (showRejectForm && note.trim().length < MIN_NOTE_LENGTH)} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40" style={{ color: "#dc2626", borderColor: "rgba(220,38,38,0.45)", background: "rgba(220,38,38,0.04)" }}>{submitting === "reject" ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}{showRejectForm ? "Send change request" : "Request changes"}</button>}
            {can.approve && !showRejectForm && <button type="button" onClick={handleApprove} disabled={Boolean(submitting) || loading || !approvalReady} title={!approvalReady ? "Resolve all blocking readiness issues before approval" : undefined} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{submitting === "approve" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}Approve content</button>}
          </div>
        </footer>
      </section>
    </div>,
    document.body
  );
}
