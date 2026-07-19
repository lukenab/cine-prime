import {
  X, Film, Tag, Globe, Users, Clock, Calendar, MapPin,
  Building2, ExternalLink, Play, ShieldCheck, Images, Loader2,
} from "lucide-react";
import { useState } from "react";
import type { MovieV2 } from "../api/movieApi";
import {
  MOVIE_CONTENT_STATUS_META,
  toMovieContentStatus,
} from "../utils/movieContentStatus";
import { MovieAvailabilityPanel } from "./MovieAvailabilityPanel";

type Props = {
  open: boolean;
  movie: MovieV2 | null;
  loading?: boolean;
  onClose: () => void;
};

const LANG_NAME: Record<string, string> = {
  en: "English", vi: "Tiếng Việt", ja: "日本語", ko: "한국어",
  zh: "中文", fr: "Français", th: "ภาษาไทย",
};

export function MovieDetailModal({ open, movie, loading, onClose }: Props) {
  const [synopsisLang, setSynopsisLang] = useState<"vi" | "en">("vi");
  const [galleryIdx, setGalleryIdx] = useState(0);

  if (!open) return null;

  const FL: React.CSSProperties = {
    fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.07em",
    textTransform: "uppercase", color: "var(--text-sub)", marginBottom: "4px",
  };
  const FV: React.CSSProperties = { fontSize: "14px", color: "var(--text-main)" };

  /* ── Loading skeleton ── */
  if (loading || !movie) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
        <div
          className="relative w-full max-w-4xl mx-4 rounded-2xl shadow-2xl flex items-center justify-center"
          style={{ background: "var(--bg-main)", height: "300px" }}
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

  const vi = movie.translations?.find(t => t.languageCode === "vi");
  const en = movie.translations?.find(t => t.languageCode === "en");
  const directors = movie.cast?.filter(c => c.roleType === "DIRECTOR") ?? [];
  const actors    = movie.cast?.filter(c => c.roleType === "ACTOR")    ?? [];
  const contentStatus = toMovieContentStatus(movie.status);
  const status = MOVIE_CONTENT_STATUS_META[contentStatus];
  const fmtDur    = (m: number) => { const h = Math.floor(m / 60); const min = m % 60; return h > 0 ? `${h}h ${min}m` : `${min}m`; };
  const images    = movie.images ?? [];
  const mainPoster = images.find(i => i.imageType === "POSTER")?.imageUrl ?? movie.posterUrl;
  const galleryImages = images.length ? images : (movie.posterUrl ? [{ imageId: 0, imageUrl: movie.posterUrl, imageType: "POSTER" as const }] : []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="relative w-full max-w-4xl mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-main)", maxHeight: "92vh" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Film size={15} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {vi?.title ?? en?.title ?? movie.originalTitle}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>#{movie.movieId}</span>
                <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>·</span>
                <span
                  className="px-2 py-0.5 rounded-md text-xs font-medium"
                  style={{ color: status.text, background: status.bg }}
                >
                  {status.label}
                </span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center flex-shrink-0 transition-colors" style={{ color: "var(--text-sub)" }}>
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr]">

            {/* Left — poster + gallery */}
            <div className="p-5 border-r flex-shrink-0" style={{ borderColor: "var(--border-color)" }}>
              {/* Main image */}
              <div className="rounded-xl overflow-hidden border aspect-[2/3]" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                {mainPoster ? (
                  <img src={mainPoster} alt={movie.originalTitle} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film size={40} style={{ color: "var(--text-sub)" }} />
                  </div>
                )}
              </div>

              {/* Gallery strip */}
              {galleryImages.length > 1 && (
                <div className="mt-3 space-y-1.5">
                  <p style={FL}>Gallery ({galleryImages.length})</p>
                  <div className="grid grid-cols-3 gap-1">
                    {galleryImages.slice(0, 6).map((img, idx) => (
                      <button
                        key={img.imageId}
                        type="button"
                        onClick={() => setGalleryIdx(idx)}
                        className="rounded-lg overflow-hidden border transition-all"
                        style={{
                          borderColor: galleryIdx === idx ? "#3b82f6" : "var(--border-color)",
                          outline: galleryIdx === idx ? "2px solid #3b82f6" : "none",
                          outlineOffset: "1px",
                        }}
                      >
                        <img src={img.imageUrl} alt="" className="w-full aspect-square object-cover" />
                      </button>
                    ))}
                  </div>
                  {galleryImages.length > 6 && (
                    <p style={{ fontSize: "11px", color: "var(--text-sub)", textAlign: "center" }}>
                      +{galleryImages.length - 6} more
                    </p>
                  )}
                </div>
              )}

              {/* External links */}
              <div className="mt-4 space-y-2">
                {movie.tmdbId && (
                  <a
                    href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors hover:border-blue-400 hover:bg-blue-50"
                    style={{ borderColor: "var(--border-color)", fontSize: "12px", color: "var(--text-sub)", textDecoration: "none" }}
                  >
                    <ExternalLink size={12} /> TMDB #{movie.tmdbId}
                  </a>
                )}
                {movie.imdbId && (
                  <a
                    href={`https://www.imdb.com/title/${movie.imdbId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors hover:border-amber-400 hover:bg-amber-50"
                    style={{ borderColor: "var(--border-color)", fontSize: "12px", color: "var(--text-sub)", textDecoration: "none" }}
                  >
                    <ExternalLink size={12} /> IMDb
                  </a>
                )}
                {movie.trailerUrl && (
                  <a
                    href={movie.trailerUrl}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors hover:border-rose-400 hover:bg-rose-50"
                    style={{ borderColor: "var(--border-color)", fontSize: "12px", color: "var(--text-sub)", textDecoration: "none" }}
                  >
                    <Play size={12} /> Watch Trailer
                  </a>
                )}
              </div>
            </div>

            {/* Right — details */}
            <div className="p-6 space-y-6">

              {/* Title block */}
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.25 }}>
                  {en?.title ?? movie.originalTitle}
                </h2>
                {vi?.title && vi.title !== en?.title && (
                  <p style={{ fontSize: "14px", color: "var(--text-sub)", marginTop: "3px" }}>{vi.title}</p>
                )}
                {movie.originalTitle !== (en?.title ?? movie.originalTitle) && (
                  <p style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "2px", fontStyle: "italic" }}>
                    Original: {movie.originalTitle}
                  </p>
                )}
              </div>

              {/* Quick stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { Icon: Clock,    label: "Duration",  value: movie.durationMinutes ? fmtDur(movie.durationMinutes) : "—" },
                  { Icon: Calendar, label: "Release",   value: movie.releaseDate ?? "—" },
                  { Icon: Globe,    label: "Language",  value: LANG_NAME[movie.originalLanguage] ?? movie.originalLanguage ?? "—" },
                  { Icon: MapPin,   label: "Country",   value: movie.country ?? "—" },
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

              {/* Genres + Formats + Age Rating */}
              <div className="space-y-3">
                {movie.genres?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Tag size={12} style={{ color: "var(--text-sub)" }} />
                      <p style={FL}>Genres</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {movie.genres.map(g => (
                        <span key={g.genreId} className="px-2.5 py-1 rounded-lg border text-xs font-medium" style={{ background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}>
                          {g.genreName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {movie.formats?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Film size={12} style={{ color: "var(--text-sub)" }} />
                      <p style={FL}>Screening Formats</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {movie.formats.map(f => (
                        <span key={f.formatId} className="px-2.5 py-1 rounded-lg border text-xs font-semibold" style={{ background: "rgba(59,130,246,0.06)", color: "#2563eb", borderColor: "rgba(59,130,246,0.2)" }}>
                          {f.formatCode}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {movie.ageRating && (
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={12} style={{ color: "var(--text-sub)" }} />
                    <p style={FL}>Age Rating</p>
                    <span className="px-2.5 py-0.5 rounded-lg border text-xs font-bold" style={{ background: "rgba(239,68,68,0.07)", color: "#dc2626", borderColor: "rgba(239,68,68,0.2)" }}>
                      {movie.ageRating.ratingCode}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>{movie.ageRating.description}</span>
                  </div>
                )}
              </div>

              {/* Tagline - `[Backend] Add tagline field to Movie and MovieTranslation entities`:
                  a short catchphrase, deliberately not shown as/instead of the synopsis below. */}
              {(vi?.tagline || en?.tagline || movie.tagline) && (
                <p style={{ fontSize: "13px", fontStyle: "italic", color: "var(--text-sub)" }}>
                  “{synopsisLang === "vi" ? (vi?.tagline ?? en?.tagline ?? movie.tagline) : (en?.tagline ?? vi?.tagline ?? movie.tagline)}”
                </p>
              )}

              {/* Synopsis */}
              {(vi?.synopsis || en?.synopsis) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Globe size={12} style={{ color: "var(--text-sub)" }} />
                      <p style={FL}>Synopsis</p>
                    </div>
                    <div className="flex gap-1">
                      {vi?.synopsis && (
                        <button type="button" onClick={() => setSynopsisLang("vi")}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: synopsisLang === "vi" ? "var(--bg-card)" : "transparent", color: synopsisLang === "vi" ? "var(--text-main)" : "var(--text-sub)", border: `1px solid ${synopsisLang === "vi" ? "var(--border-color)" : "transparent"}` }}>
                          🇻🇳 VI
                        </button>
                      )}
                      {en?.synopsis && (
                        <button type="button" onClick={() => setSynopsisLang("en")}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
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

              {/* Cast */}
              {(directors.length > 0 || actors.length > 0) && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Users size={12} style={{ color: "var(--text-sub)" }} />
                    <p style={FL}>Cast & Crew</p>
                  </div>

                  {directors.length > 0 && (
                    <div className="mb-3">
                      <p style={{ fontSize: "11px", color: "var(--text-sub)", fontWeight: 600, marginBottom: "8px" }}>DIRECTOR{directors.length > 1 ? "S" : ""}</p>
                      <div className="flex flex-wrap gap-3">
                        {directors.map(d => (
                          <div key={d.personId} className="flex items-center gap-2">
                            {d.photoUrl ? (
                              <img src={d.photoUrl} alt={d.fullName} className="w-8 h-8 rounded-full object-cover border" style={{ borderColor: "var(--border-color)" }} />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center border" style={{ borderColor: "var(--border-color)", fontSize: "11px", fontWeight: 700, color: "#2563eb" }}>
                                {d.fullName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>{d.fullName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {actors.length > 0 && (
                    <div>
                      <p style={{ fontSize: "11px", color: "var(--text-sub)", fontWeight: 600, marginBottom: "8px" }}>ACTORS</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {actors.slice(0, 9).map(a => (
                          <div key={a.personId} className="flex items-center gap-2 rounded-lg p-2 border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                            {a.photoUrl ? (
                              <img src={a.photoUrl} alt={a.fullName} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0" style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280" }}>
                                {a.fullName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fullName}</p>
                              {a.characterName && (
                                <p style={{ fontSize: "11px", color: "var(--text-sub)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>as {a.characterName}</p>
                              )}
                            </div>
                          </div>
                        ))}
                        {actors.length > 9 && (
                          <div className="flex items-center justify-center rounded-lg border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", minHeight: "52px" }}>
                            <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>+{actors.length - 9} more</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Availability by cluster — content must be APPROVED before any
                  release plan can exist (MOV-LC-06). */}
              {contentStatus === "APPROVED" && (
                <div className="rounded-xl border p-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                  <MovieAvailabilityPanel movieId={movie.movieId} />
                </div>
              )}

              {/* Production Companies */}
              {movie.companies && movie.companies.length > 0 && (
                <div className="flex items-center gap-2">
                  <Building2 size={12} style={{ color: "var(--text-sub)" }} />
                  <p style={FL}>Production</p>
                  <p style={{ fontSize: "13px", color: "var(--text-main)", fontWeight: 500 }}>
                    {movie.companies.map((c) => c.name).join(", ")}
                  </p>
                </div>
              )}

              {/* Gallery images row */}
              {images.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Images size={12} style={{ color: "var(--text-sub)" }} />
                    <p style={FL}>Photo Gallery ({images.length})</p>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.map(img => (
                      <div key={img.imageId} className="flex-shrink-0 rounded-lg overflow-hidden border" style={{ borderColor: "var(--border-color)", width: "100px", height: "70px" }}>
                        <img src={img.imageUrl} alt={img.caption ?? img.imageType} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3 border-t flex items-center justify-between flex-shrink-0" style={{ borderColor: "var(--border-color)" }}>
          <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>
            Added {movie.createdAt ? new Date(movie.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
            {movie.updatedAt && movie.updatedAt !== movie.createdAt && ` · Updated ${new Date(movie.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`}
          </p>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border transition-colors hover:opacity-80" style={{ fontSize: "13px", color: "var(--text-main)", borderColor: "var(--border-color)" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
