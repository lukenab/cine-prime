import {
  X, Film, Tag, Globe, Users, Clock, Calendar, MapPin,
  Building2, ExternalLink, Play, ShieldCheck, Loader2, ChevronLeft, ChevronRight, Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MovieResponse } from "../api/movieApi";
import {
  MOVIE_CONTENT_STATUS_META,
  toMovieContentStatus,
} from "../utils/movieContentStatus";
import { MovieAvailabilityPanel } from "./MovieAvailabilityPanel";

type Props = {
  open: boolean;
  movie: MovieResponse | null;
  loading?: boolean;
  onClose: () => void;
};

type TabKey = "overview" | "cast" | "availability";

const LANG_NAME: Record<string, string> = {
  en: "English", vi: "Tiếng Việt", ja: "日本語", ko: "한국어",
  zh: "中文", fr: "Français", th: "ภาษาไทย",
};

const FL: React.CSSProperties = {
  fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.07em",
  textTransform: "uppercase", color: "var(--text-sub)", marginBottom: "4px",
};

function SectionLabel({ icon: Icon, children }: { icon: typeof Tag; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      <Icon size={12} style={{ color: "var(--text-sub)" }} />
      <p style={FL}>{children}</p>
    </div>
  );
}

export function MovieDetailModal({ open, movie, loading, onClose }: Props) {
  const [synopsisLang, setSynopsisLang] = useState<"vi" | "en">("vi");
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [carouselPaused, setCarouselPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Esc-to-close + body scroll lock, matching the customer-facing preview modal's behavior.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Reset per-movie so switching movies without closing the modal doesn't carry over
  // the previous movie's selected tab/gallery slide/synopsis language.
  useEffect(() => {
    setActiveTab("overview");
    setGalleryIdx(0);
    setCarouselPaused(false);
  }, [movie?.movieId]);

  const vi = movie?.translations?.find(t => t.languageCode === "vi");
  const en = movie?.translations?.find(t => t.languageCode === "en");
  const directors = movie?.cast?.filter(c => c.roleType === "DIRECTOR") ?? [];
  const actors = movie?.cast?.filter(c => c.roleType === "ACTOR") ?? [];
  const contentStatus = movie ? toMovieContentStatus(movie.status) : "DRAFT";
  const status = MOVIE_CONTENT_STATUS_META[contentStatus];
  const fmtDur = (m: number) => { const h = Math.floor(m / 60); const min = m % 60; return h > 0 ? `${h}h ${min}m` : `${min}m`; };
  const images = movie?.images ?? [];
  const mainPoster = images.find(i => i.imageType === "POSTER")?.imageUrl ?? movie?.posterUrl;
  // Posters remain portrait artwork beside the title; landscape assets become the hero carousel.
  const heroImages = images.filter(i => i.imageType !== "POSTER");
  const createdAt = movie?.createdAt ? new Date(movie.createdAt).getTime() : Number.NaN;
  const ageInDays = Number.isNaN(createdAt) ? Number.POSITIVE_INFINITY : (Date.now() - createdAt) / 86_400_000;
  const isNewMovie = ageInDays >= 0 && ageInDays <= 14;

  // Auto-advance the hero carousel just like the customer movie detail modal.
  useEffect(() => {
    if (carouselPaused || heroImages.length <= 1) return;
    const id = setInterval(() => setGalleryIdx((i) => (i + 1) % heroImages.length), 4000);
    return () => clearInterval(id);
  }, [carouselPaused, heroImages.length]);

  const SWIPE_THRESHOLD_PX = 40;
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setCarouselPaused(true);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (heroImages.length > 1 && Math.abs(delta) > SWIPE_THRESHOLD_PX) {
      setGalleryIdx((i) => {
        const dir = delta < 0 ? 1 : -1;
        return (i + dir + heroImages.length) % heroImages.length;
      });
    }
    touchStartX.current = null;
    setCarouselPaused(false);
  };

  const tabs = useMemo(() => ([
    { key: "overview" as TabKey, label: "Overview", show: true },
    { key: "cast" as TabKey, label: "Cast & Crew", show: directors.length > 0 || actors.length > 0 },
    { key: "availability" as TabKey, label: "Availability", show: contentStatus === "APPROVED" },
  ].filter(t => t.show)), [directors.length, actors.length, contentStatus]);

  const tab = tabs.some(t => t.key === activeTab) ? activeTab : "overview";

  if (!open) return null;

  /* ── Loading skeleton ── */
  if (loading || !movie) {
    return createPortal(
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm" style={{ zIndex: 1000 }} onClick={onClose}>
        <div
          className="relative flex w-full max-w-3xl items-center justify-center rounded-2xl shadow-2xl"
          style={{ background: "#0f1117", height: "320px" }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}>
            <X size={16} />
          </button>
          <div className="flex flex-col items-center gap-3" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Loader2 size={28} className="animate-spin" />
            <p style={{ fontSize: "14px" }}>Loading movie details…</p>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const title = en?.title ?? movie.originalTitle;
  const displayGenreCount = movie.genres?.length ?? 0;

  return createPortal(
    <div className="fixed inset-0 flex items-start justify-center overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: 1000 }} onClick={onClose}>
      <div
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: "#0f1117",
          maxHeight: "92vh",
          "--text-main": "#ffffff",
          "--text-sub": "rgba(255,255,255,0.5)",
          "--bg-main": "#0f1117",
          "--bg-card": "rgba(255,255,255,0.035)",
          "--bg-hover": "rgba(255,255,255,0.07)",
          "--border-color": "rgba(255,255,255,0.09)",
        } as React.CSSProperties}
        onClick={(event) => event.stopPropagation()}
      >
        {/* ── Hero ── */}
        <div className="relative flex-shrink-0" style={{ background: "#0f1117" }}>
          <div
            className="relative h-44 select-none overflow-hidden sm:h-56"
            style={{ touchAction: "pan-y" }}
            onMouseEnter={() => setCarouselPaused(true)}
            onMouseLeave={() => setCarouselPaused(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {heroImages.length > 0 ? (
              <img
                key={heroImages[galleryIdx]?.imageId}
                src={heroImages[galleryIdx]?.imageUrl}
                alt={heroImages[galleryIdx]?.caption ?? heroImages[galleryIdx]?.imageType}
                className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-300"
              />
            ) : mainPoster ? (
              <img src={mainPoster} alt="" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-60" />
            ) : null}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 65%, #0f1117 100%)" }}
            />
            {heroImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setGalleryIdx((i) => (i - 1 + heroImages.length) % heroImages.length)}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full"
                  style={{ background: "rgba(0,0,0,0.45)", color: "#fff" }}
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryIdx((i) => (i + 1) % heroImages.length)}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full"
                  style={{ background: "rgba(0,0,0,0.45)", color: "#fff" }}
                >
                  <ChevronRight size={15} />
                </button>
                <div className="absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
                  {heroImages.map((image, index) => (
                    <button
                      key={image.imageId}
                      type="button"
                      onClick={() => setGalleryIdx(index)}
                      aria-label={`Go to image ${index + 1}`}
                      className="rounded-full transition-all"
                      style={{
                        width: index === galleryIdx ? "14px" : "5px",
                        height: "5px",
                        background: index === galleryIdx ? "#FFD700" : "rgba(255,255,255,0.5)",
                      }}
                    />
                  ))}
                </div>
              </>
            )}
            <button
              type="button" onClick={onClose} aria-label="Close"
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              style={{ background: "rgba(0,0,0,0.45)", color: "#fff" }}
            >
              <X size={16} />
            </button>
          </div>

          <div className="relative px-6 pb-4 -mt-14 flex gap-4 items-end sm:px-8">
            {/* Poster */}
            <div
              className="w-20 sm:w-24 flex-shrink-0 rounded-xl overflow-hidden border-2 shadow-lg aspect-[2/3]"
              style={{ borderColor: "#0f1117", background: "#1a1d26" }}
            >
              {mainPoster ? (
                <img src={mainPoster} alt={movie.originalTitle} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film size={24} style={{ color: "rgba(255,255,255,0.4)" }} />
                </div>
              )}
            </div>

            {/* Title + meta */}
            <div className="flex-1 min-w-0 pb-0.5">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                  style={{ color: status.dot, background: `${status.dot}26`, border: `1px solid ${status.dot}40` }}
                >
                  {status.label}
                </span>
                {isNewMovie && (
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-bold" style={{ color: "#c084fc", background: "rgba(168,85,247,0.16)", border: "1px solid rgba(168,85,247,0.3)" }}>
                    <Sparkles size={10} /> NEW
                  </span>
                )}
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>#{movie.movieId}</span>
              </div>
              <h2
                className="font-bold leading-tight"
                style={{ fontSize: "19px", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={title}
              >
                {title}
              </h2>
              {vi?.title && vi.title !== title && (
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {vi.title}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2" style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)" }}>
                {movie.durationMinutes ? <span className="flex items-center gap-1"><Clock size={11} /> {fmtDur(movie.durationMinutes)}</span> : null}
                {movie.releaseDate ? <span className="flex items-center gap-1"><Calendar size={11} /> {movie.releaseDate}</span> : null}
                {movie.ageRating ? (
                  <span className="px-1.5 py-0.5 rounded border text-[10.5px] font-bold" style={{ background: "rgba(239,68,68,0.07)", color: "#dc2626", borderColor: "rgba(239,68,68,0.2)" }}>
                    {movie.ageRating.ratingCode}
                  </span>
                ) : null}
                {displayGenreCount > 0 ? <span>{movie.genres.slice(0, 3).map(g => g.genreName).join(", ")}{displayGenreCount > 3 ? "…" : ""}</span> : null}
              </div>
            </div>
          </div>
        </div>

        {/* Changes requested reason — surfaced above the tabs since it's actionable
            regardless of which tab the admin lands on. */}
        {contentStatus === "CHANGES_REQUESTED" && movie.rejectionNote && (
          <div className="mx-6 sm:mx-8 mt-3 rounded-xl border p-3 flex-shrink-0" style={{ borderColor: "rgba(248,113,113,0.3)", background: "rgba(239,68,68,0.08)" }}>
            <p style={{ ...FL, color: "#f87171" }}>Changes requested</p>
            <p style={{ fontSize: "13px", color: "#fecaca", lineHeight: 1.6 }}>{movie.rejectionNote}</p>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 px-6 sm:px-8 border-b flex-shrink-0 mt-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className="relative px-3 py-2.5 text-[13px] font-medium transition-colors cursor-pointer"
              style={{ color: tab === t.key ? "#fff" : "rgba(255,255,255,0.5)" }}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute left-3 right-3 bottom-0 h-[2px] rounded-full" style={{ background: "#FFD700" }} />
              )}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="nice-scrollbar overflow-y-auto flex-1 px-6 py-5 sm:px-8">

          {tab === "overview" && (
            <div className="space-y-6">
              {(vi?.tagline || en?.tagline || movie.tagline) && (
                <p style={{ fontSize: "13.5px", fontStyle: "italic", color: "var(--text-sub)" }}>
                  “{synopsisLang === "vi" ? (vi?.tagline ?? en?.tagline ?? movie.tagline) : (en?.tagline ?? vi?.tagline ?? movie.tagline)}”
                </p>
              )}

              {(vi?.synopsis || en?.synopsis) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <SectionLabel icon={Globe}>Synopsis</SectionLabel>
                    <div className="flex gap-1">
                      {vi?.synopsis && (
                        <button type="button" onClick={() => setSynopsisLang("vi")}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          style={{ background: synopsisLang === "vi" ? "var(--bg-card)" : "transparent", color: synopsisLang === "vi" ? "var(--text-main)" : "var(--text-sub)", border: `1px solid ${synopsisLang === "vi" ? "var(--border-color)" : "transparent"}` }}>
                          🇻🇳 VI
                        </button>
                      )}
                      {en?.synopsis && (
                        <button type="button" onClick={() => setSynopsisLang("en")}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          style={{ background: synopsisLang === "en" ? "var(--bg-card)" : "transparent", color: synopsisLang === "en" ? "var(--text-main)" : "var(--text-sub)", border: `1px solid ${synopsisLang === "en" ? "var(--border-color)" : "transparent"}` }}>
                          🇬🇧 EN
                        </button>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: "13.5px", color: "var(--text-main)", lineHeight: 1.75 }}>
                    {synopsisLang === "vi" ? (vi?.synopsis ?? en?.synopsis) : (en?.synopsis ?? vi?.synopsis)}
                  </p>
                </div>
              )}

              {/* Quick facts grid — language/country/format live here since duration/release
                  already surfaced in the hero strip above; age rating repeats the hero badge
                  but with its full description, which doesn't fit in the hero strip. */}
              <div className="flex flex-wrap gap-2">
                {[
                  { Icon: Globe, label: "Language", value: LANG_NAME[movie.originalLanguage] ?? movie.originalLanguage ?? "—" },
                  { Icon: MapPin, label: "Country", value: movie.country ?? "—" },
                  { Icon: Film, label: "Formats", value: movie.formats?.length ? movie.formats.map(f => f.formatCode).join(" / ") : "—" },
                  { Icon: ShieldCheck, label: "Age Rating", value: movie.ageRating ? `${movie.ageRating.ratingCode} · ${movie.ageRating.description}` : "—" },
                ].map(({ Icon, label, value }) => {
                  const badgeColor = label === "Language" ? "#60a5fa" : label === "Country" ? "#34d399" : label === "Formats" ? "#f472b6" : "#f87171";
                  return (
                  <div key={label} className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ border: `1px solid ${badgeColor}45`, background: `${badgeColor}18` }}>
                    <Icon size={13} style={{ color: badgeColor }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: badgeColor }}>{value}</span>
                  </div>
                  );
                })}
              </div>

              {movie.genres?.length > 0 && (
                <div>
                  <SectionLabel icon={Tag}>Genres</SectionLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {movie.genres.map(g => (
                      <span key={g.genreId} className="px-2.5 py-1 rounded-lg border text-xs font-medium" style={{ background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}>
                        {g.genreName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {movie.companies && movie.companies.length > 0 && (
                <div>
                  <SectionLabel icon={Building2}>Production</SectionLabel>
                  <p style={{ fontSize: "13px", color: "var(--text-main)" }}>
                    {movie.companies.map((c) => c.name).join(", ")}
                  </p>
                </div>
              )}

              {/* External links */}
              {(movie.tmdbId || movie.imdbId || movie.trailerUrl) && (
                <div className="flex flex-wrap gap-2">
                  {movie.tmdbId && (
                    <a
                      href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors hover:border-blue-400 hover:bg-blue-50"
                      style={{ borderColor: "var(--border-color)", fontSize: "12px", color: "var(--text-sub)", textDecoration: "none" }}
                    >
                      <ExternalLink size={12} /> TMDB #{movie.tmdbId}
                    </a>
                  )}
                  {movie.imdbId && (
                    <a
                      href={`https://www.imdb.com/title/${movie.imdbId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors hover:border-amber-400 hover:bg-amber-50"
                      style={{ borderColor: "var(--border-color)", fontSize: "12px", color: "var(--text-sub)", textDecoration: "none" }}
                    >
                      <ExternalLink size={12} /> IMDb
                    </a>
                  )}
                  {movie.trailerUrl && (
                    <a
                      href={movie.trailerUrl}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors hover:border-rose-400 hover:bg-rose-50"
                      style={{ borderColor: "var(--border-color)", fontSize: "12px", color: "var(--text-sub)", textDecoration: "none" }}
                    >
                      <Play size={12} /> Watch Trailer
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "cast" && (
            <div className="space-y-6">
              {directors.length > 0 && (
                <div>
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
                </div>
              )}

              {actors.length > 0 && (
                <div>
                  <SectionLabel icon={Users}>Actors</SectionLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {actors.map(a => (
                      <div key={a.personId} className="flex items-center gap-2.5 rounded-lg p-2.5 border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
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
                </div>
              )}
            </div>
          )}

          {tab === "availability" && contentStatus === "APPROVED" && (
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
              <MovieAvailabilityPanel movieId={movie.movieId} />
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3 border-t flex items-center justify-between flex-shrink-0" style={{ borderColor: "var(--border-color)" }}>
          <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>
            Added {movie.createdAt ? new Date(movie.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
            {movie.updatedAt && movie.updatedAt !== movie.createdAt && ` · Updated ${new Date(movie.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`}
          </p>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border transition-colors hover:opacity-80 cursor-pointer" style={{ fontSize: "13px", color: "var(--text-main)", borderColor: "var(--border-color)" }}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
