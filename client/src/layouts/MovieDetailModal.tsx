import {
  X, Film, Tag, Globe, Users, Clock, Calendar, MapPin,
  Building2, ExternalLink, Play, ShieldCheck, Images, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

type TabKey = "overview" | "cast" | "media" | "availability";

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
  const backdrop = images.find(i => i.imageType === "BACKDROP")?.imageUrl ?? images.find(i => i.isDefault)?.imageUrl;
  const galleryImages = images.length ? images : (movie?.posterUrl ? [{ imageId: 0, imageUrl: movie.posterUrl, imageType: "POSTER" as const }] : []);

  const tabs = useMemo(() => ([
    { key: "overview" as TabKey, label: "Overview", show: true },
    { key: "cast" as TabKey, label: "Cast & Crew", show: directors.length > 0 || actors.length > 0 },
    { key: "media" as TabKey, label: `Media${galleryImages.length ? ` · ${galleryImages.length}` : ""}`, show: galleryImages.length > 0 },
    { key: "availability" as TabKey, label: "Availability", show: contentStatus === "APPROVED" },
  ].filter(t => t.show)), [directors.length, actors.length, galleryImages.length, contentStatus]);

  const tab = tabs.some(t => t.key === activeTab) ? activeTab : "overview";

  if (!open) return null;

  /* ── Loading skeleton ── */
  if (loading || !movie) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
        <div
          className="relative w-full max-w-4xl mx-4 rounded-2xl shadow-2xl flex items-center justify-center"
          style={{ background: "var(--bg-main)", height: "320px" }}
        >
          <button type="button" onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center" style={{ color: "var(--text-sub)" }}>
            <X size={16} />
          </button>
          <div className="flex flex-col items-center gap-3" style={{ color: "var(--text-sub)" }}>
            <Loader2 size={28} className="animate-spin" />
            <p style={{ fontSize: "14px" }}>Loading movie details…</p>
          </div>
        </div>
      </div>
    );
  }

  const title = en?.title ?? movie.originalTitle;
  const displayGenreCount = movie.genres?.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="relative w-full max-w-4xl mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-main)", maxHeight: "92vh" }}
      >
        {/* ── Hero ── */}
        <div className="relative flex-shrink-0" style={{ background: "var(--bg-card)" }}>
          <div className="relative h-44 sm:h-56 overflow-hidden">
            {backdrop ? (
              <img src={backdrop} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : mainPoster ? (
              <img src={mainPoster} alt="" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-60" />
            ) : null}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 65%, var(--bg-card) 100%)" }}
            />
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
              style={{ borderColor: "var(--bg-main)", background: "var(--bg-card)" }}
            >
              {mainPoster ? (
                <img src={mainPoster} alt={movie.originalTitle} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film size={24} style={{ color: "var(--text-sub)" }} />
                </div>
              )}
            </div>

            {/* Title + meta */}
            <div className="flex-1 min-w-0 pb-0.5">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                  style={{ color: status.text, background: status.bg }}
                >
                  {status.label}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>#{movie.movieId}</span>
              </div>
              <h2
                className="font-bold leading-tight"
                style={{ fontSize: "19px", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={title}
              >
                {title}
              </h2>
              {vi?.title && vi.title !== title && (
                <p style={{ fontSize: "13px", color: "var(--text-sub)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {vi.title}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>
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
          <div className="mx-6 sm:mx-8 mt-3 rounded-xl border p-3 flex-shrink-0" style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
            <p style={{ ...FL, color: "#b91c1c" }}>Changes requested</p>
            <p style={{ fontSize: "13px", color: "#7f1d1d", lineHeight: 1.6 }}>{movie.rejectionNote}</p>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 px-6 sm:px-8 border-b flex-shrink-0 mt-3" style={{ borderColor: "var(--border-color)" }}>
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className="relative px-3 py-2.5 text-[13px] font-medium transition-colors cursor-pointer"
              style={{ color: tab === t.key ? "var(--text-main)" : "var(--text-sub)" }}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute left-3 right-3 bottom-0 h-[2px] rounded-full" style={{ background: "#2563eb" }} />
              )}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 sm:px-8">

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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { Icon: Globe, label: "Language", value: LANG_NAME[movie.originalLanguage] ?? movie.originalLanguage ?? "—" },
                  { Icon: MapPin, label: "Country", value: movie.country ?? "—" },
                  { Icon: Film, label: "Formats", value: movie.formats?.length ? movie.formats.map(f => f.formatCode).join(" / ") : "—" },
                  { Icon: ShieldCheck, label: "Age Rating", value: movie.ageRating ? `${movie.ageRating.ratingCode} · ${movie.ageRating.description}` : "—" },
                ].map(({ Icon, label, value }) => (
                  <div key={label} className="rounded-xl border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={12} style={{ color: "var(--text-sub)" }} />
                      <p style={FL}>{label}</p>
                    </div>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>{value}</p>
                  </div>
                ))}
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

          {tab === "media" && galleryImages.length > 0 && (
            <div>
              <div
                className="rounded-xl overflow-hidden border relative"
                style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", aspectRatio: "16/9" }}
              >
                <img
                  src={galleryImages[galleryIdx]?.imageUrl}
                  alt={galleryImages[galleryIdx]?.caption ?? galleryImages[galleryIdx]?.imageType}
                  className="w-full h-full object-contain"
                />
                {galleryImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setGalleryIdx((i) => (i - 1 + galleryImages.length) % galleryImages.length)}
                      aria-label="Previous image"
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                      style={{ background: "rgba(0,0,0,0.45)", color: "#fff" }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryIdx((i) => (i + 1) % galleryImages.length)}
                      aria-label="Next image"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                      style={{ background: "rgba(0,0,0,0.45)", color: "#fff" }}
                    >
                      <ChevronRight size={16} />
                    </button>
                    <span
                      className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[11px] font-medium"
                      style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
                    >
                      {galleryIdx + 1} / {galleryImages.length}
                    </span>
                  </>
                )}
              </div>

              {galleryImages.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {galleryImages.map((img, idx) => (
                    <button
                      key={img.imageId}
                      type="button"
                      onClick={() => setGalleryIdx(idx)}
                      className="flex-shrink-0 rounded-lg overflow-hidden border transition-all cursor-pointer"
                      style={{
                        width: "72px", height: "72px",
                        borderColor: galleryIdx === idx ? "#2563eb" : "var(--border-color)",
                        outline: galleryIdx === idx ? "2px solid #2563eb" : "none",
                        outlineOffset: "1px",
                      }}
                    >
                      <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-2 flex items-center gap-1.5" style={{ fontSize: "11.5px", color: "var(--text-sub)" }}>
                <Images size={11} /> {galleryImages[galleryIdx]?.imageType ?? "IMAGE"}
              </p>
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
    </div>
  );
}
