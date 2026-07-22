import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Film, Tag, Globe, Users, Clock, Calendar, MapPin, Building2,
  ExternalLink, Play, ShieldCheck, Loader2, ChevronLeft, ChevronRight, Ticket, CalendarClock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { movieApi, type PublicMovieResponse } from "../../api/movieApi";

type Props = {
  /** null closes the modal. Only the ID is needed — the modal fetches the rich
   *  detail itself via movieApi.getPublicMovieDetail() (cast/gallery/age-rating/
   *  formats/companies/translations aren't part of the list payload). */
  movieId: number | null;
  clusterId?: number;
  onClose: () => void;
};

type TabKey = "overview" | "cast";

const LANG_NAME: Record<string, string> = {
  en: "English", vi: "Tiếng Việt", ja: "日本語", ko: "한국어",
  zh: "中文", fr: "Français", th: "ภาษาไทย",
};

const FL: React.CSSProperties = {
  fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.07em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: "4px",
};

function SectionLabel({ icon: Icon, children }: { icon: typeof Tag; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      <Icon size={12} style={{ color: "rgba(255,255,255,0.4)" }} />
      <p style={FL}>{children}</p>
    </div>
  );
}

function formatDuration(min?: number): string {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function CustomerMovieDetailModal({ movieId, clusterId, onClose }: Props) {
  const navigate = useNavigate();
  const [movie, setMovie] = useState<PublicMovieResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [synopsisLang, setSynopsisLang] = useState<"vi" | "en">("vi");
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [carouselPaused, setCarouselPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const open = movieId != null;

  useEffect(() => {
    if (movieId == null) { setMovie(null); return; }
    let active = true;
    setLoading(true);
    setActiveTab("overview");
    setGalleryIdx(0);
    movieApi.getPublicMovieDetail(movieId, clusterId)
      .then((res) => { if (active) setMovie(res.result ?? null); })
      .catch(() => { if (active) setMovie(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [movieId, clusterId]);

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

  const vi = movie?.translations?.find(t => t.languageCode === "vi");
  const en = movie?.translations?.find(t => t.languageCode === "en");
  const directors = movie?.cast?.filter(c => c.roleType === "DIRECTOR") ?? [];
  const actors = movie?.cast?.filter(c => c.roleType === "ACTOR") ?? [];
  const images = movie?.images ?? [];
  const mainPoster = images.find(i => i.imageType === "POSTER")?.imageUrl ?? movie?.posterUrl;
  // Hero carousel excludes POSTER images - they're portrait and already shown as their own
  // thumbnail below the hero, so cropping them into this short landscape strip via object-cover
  // would look wrong twice-over. Falls back to a single blurred-poster backdrop when a movie
  // has no backdrop/still images at all (same fallback the old static hero used).
  const heroImages = images.filter(i => i.imageType !== "POSTER");
  const isComingSoon = movie?.displayStatus === "COMING_SOON";

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
    if (Math.abs(delta) > SWIPE_THRESHOLD_PX) {
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
  ].filter(t => t.show)), [directors.length, actors.length]);

  const tab = tabs.some(t => t.key === activeTab) ? activeTab : "overview";

  const handleBook = () => {
    if (!movie || isComingSoon) return;
    onClose();
    navigate(`/showtime/${movie.movieId}`);
  };

  if (!open) return null;

  const title = en?.title ?? movie?.originalTitle ?? "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm px-4 py-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
        style={{ background: "#0f1117", maxHeight: "92vh" }}
      >
        {loading || !movie ? (
          <div className="flex items-center justify-center" style={{ height: "360px" }}>
            <div className="flex flex-col items-center gap-3" style={{ color: "rgba(255,255,255,0.5)" }}>
              <Loader2 size={28} className="animate-spin" />
              <p style={{ fontSize: 14 }}>Loading movie details…</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Hero carousel ── */}
            <div className="relative flex-shrink-0">
              <div
                className="relative h-44 sm:h-56 overflow-hidden select-none"
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
                    className="absolute inset-0 w-full h-full object-cover animate-in fade-in duration-300"
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
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
                      style={{ background: "rgba(0,0,0,0.45)", color: "#fff" }}
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryIdx((i) => (i + 1) % heroImages.length)}
                      aria-label="Next image"
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
                      style={{ background: "rgba(0,0,0,0.45)", color: "#fff" }}
                    >
                      <ChevronRight size={15} />
                    </button>
                    <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
                      {heroImages.map((img, idx) => (
                        <button
                          key={img.imageId}
                          type="button"
                          onClick={() => setGalleryIdx(idx)}
                          aria-label={`Go to image ${idx + 1}`}
                          className="rounded-full transition-all cursor-pointer"
                          style={{
                            width: idx === galleryIdx ? "14px" : "5px", height: "5px",
                            background: idx === galleryIdx ? "#FFD700" : "rgba(255,255,255,0.5)",
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}

                <button
                  type="button" onClick={onClose} aria-label="Close"
                  className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                  style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="relative px-6 pb-4 -mt-14 flex gap-4 items-end sm:px-8">
                <div
                  className="w-20 sm:w-24 flex-shrink-0 rounded-xl overflow-hidden border-2 shadow-lg aspect-[2/3]"
                  style={{ borderColor: "#0f1117", background: "#1a1d26" }}
                >
                  {mainPoster ? (
                    <img src={mainPoster} alt={title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film size={24} style={{ color: "rgba(255,255,255,0.4)" }} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 pb-0.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                      style={
                        isComingSoon
                          ? { color: "#8A2BE2", background: "rgba(138,43,226,0.15)" }
                          : { color: "#FFD700", background: "rgba(255,215,0,0.12)" }
                      }
                    >
                      {isComingSoon ? "Coming Soon" : "Now Showing"}
                    </span>
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
                    {movie.durationMinutes ? <span className="flex items-center gap-1"><Clock size={11} /> {formatDuration(movie.durationMinutes)}</span> : null}
                    {isComingSoon && movie.nextShowtimeAt ? (
                      <span className="flex items-center gap-1"><Calendar size={11} /> {formatDateTime(movie.nextShowtimeAt)}</span>
                    ) : null}
                    {movie.ageRating ? (
                      <span className="px-1.5 py-0.5 rounded border text-[10.5px] font-bold" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", borderColor: "rgba(239,68,68,0.25)" }}>
                        {movie.ageRating.ratingCode}
                      </span>
                    ) : null}
                    {movie.genres?.length ? <span>{movie.genres.slice(0, 3).map(g => g.genreName).join(", ")}{movie.genres.length > 3 ? "…" : ""}</span> : null}
                  </div>
                </div>
              </div>
            </div>

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
                    <p style={{ fontSize: "13.5px", fontStyle: "italic", color: "rgba(255,255,255,0.55)" }}>
                      “{synopsisLang === "vi" ? (vi?.tagline ?? en?.tagline ?? movie.tagline) : (en?.tagline ?? vi?.tagline ?? movie.tagline)}”
                    </p>
                  )}

                  {(vi?.synopsis || en?.synopsis || movie.synopsis) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <SectionLabel icon={Globe}>Synopsis</SectionLabel>
                        {(vi?.synopsis || en?.synopsis) && (
                          <div className="flex gap-1">
                            {vi?.synopsis && (
                              <button type="button" onClick={() => setSynopsisLang("vi")}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                                style={{ background: synopsisLang === "vi" ? "rgba(255,255,255,0.08)" : "transparent", color: synopsisLang === "vi" ? "#fff" : "rgba(255,255,255,0.5)" }}>
                                🇻🇳 VI
                              </button>
                            )}
                            {en?.synopsis && (
                              <button type="button" onClick={() => setSynopsisLang("en")}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                                style={{ background: synopsisLang === "en" ? "rgba(255,255,255,0.08)" : "transparent", color: synopsisLang === "en" ? "#fff" : "rgba(255,255,255,0.5)" }}>
                                🇬🇧 EN
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.8)", lineHeight: 1.75 }}>
                        {synopsisLang === "vi" ? (vi?.synopsis ?? en?.synopsis ?? movie.synopsis) : (en?.synopsis ?? vi?.synopsis ?? movie.synopsis)}
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { Icon: Globe, color: "#60a5fa", value: (movie.originalLanguage && LANG_NAME[movie.originalLanguage]) ?? movie.originalLanguage },
                        { Icon: MapPin, color: "#34d399", value: movie.country },
                        { Icon: Film, color: "#f472b6", value: movie.formats?.length ? movie.formats.map(f => f.formatCode).join(" / ") : null },
                        { Icon: ShieldCheck, color: "#f87171", value: movie.ageRating?.ratingCode },
                      ].filter((badge) => badge.value).map(({ Icon, color, value }, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                          style={{ backgroundColor: `${color}18`, border: `1px solid ${color}45` }}
                        >
                          <Icon size={13} style={{ color }} />
                          <span style={{ color, fontSize: "0.8rem", fontWeight: 700 }}>{value}</span>
                        </div>
                      ))}
                    </div>
                    {movie.ageRating?.description && (
                      <p className="mt-2" style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.4)" }}>
                        {movie.ageRating.ratingCode} — {movie.ageRating.description}
                      </p>
                    )}
                  </div>

                  {movie.genres?.length > 0 && (
                    <div>
                      <SectionLabel icon={Tag}>Genres</SectionLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {movie.genres.map(g => (
                          <span key={g.genreId} className="px-2.5 py-1 rounded-lg border text-xs font-medium" style={{ background: "rgba(255,255,255,0.03)", color: "#fff", borderColor: "rgba(255,255,255,0.08)" }}>
                            {g.genreName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {movie.companies && movie.companies.length > 0 && (
                    <div>
                      <SectionLabel icon={Building2}>Production</SectionLabel>
                      <p style={{ fontSize: "13px", color: "#fff" }}>
                        {movie.companies.map((c) => c.name).join(", ")}
                      </p>
                    </div>
                  )}

                  {movie.trailerUrl && (
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={movie.trailerUrl}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors hover:border-[#FFD700]/50"
                        style={{ borderColor: "rgba(255,255,255,0.1)", fontSize: "12px", color: "rgba(255,255,255,0.7)", textDecoration: "none" }}
                      >
                        <Play size={12} /> Watch Trailer <ExternalLink size={11} />
                      </a>
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
                              <img src={d.photoUrl} alt={d.fullName} className="w-10 h-10 rounded-full object-cover border" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
                            ) : (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center border" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,215,0,0.1)", fontSize: "12px", fontWeight: 700, color: "#FFD700" }}>
                                {d.fullName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#fff" }}>{d.fullName}</span>
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
                          <div key={a.personId} className="flex items-center gap-2.5 rounded-lg p-2.5 border" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                            {a.photoUrl ? (
                              <img src={a.photoUrl} alt={a.fullName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
                                {a.fullName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p style={{ fontSize: "12.5px", fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fullName}</p>
                              {a.characterName && (
                                <p style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>as {a.characterName}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* ── Footer ── */}
            <div className="px-6 py-4 border-t flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              {isComingSoon ? (
                <div className="flex w-full items-center justify-center gap-2.5 rounded-full border py-3 text-[14px] font-bold uppercase tracking-wide" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)" }}>
                  <CalendarClock size={17} />
                  {movie.nextShowtimeAt ? `Tickets on sale ${formatDateTime(movie.nextShowtimeAt)}` : "Tickets on sale soon"}
                </div>
              ) : (
                <button
                  onClick={handleBook}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFC400] to-[#FFA500] py-2.5 text-[13px] font-bold uppercase tracking-wide text-black transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                  style={{ boxShadow: "0 6px 20px rgba(255,175,0,0.3)" }}
                >
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                  <Ticket size={15} />
                  Book Tickets
                  <ChevronRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
