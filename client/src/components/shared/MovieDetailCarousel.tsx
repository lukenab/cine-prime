import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  X, ChevronLeft, ChevronRight, Star, Clock, Ticket,
  UserRound, Film, Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { MovieApiResponse } from "../../api/movieApi";
import { toDateStr } from "../../api/movieApi";

type Props = {
  movie: MovieApiResponse | null;
  onClose: () => void;
};

// Fallback stills — only used when a movie ships no gallery/backdrops of its
// own (e.g. a backend movie with just a poster). Real per-movie images always
// take priority so the carousel never shows art unrelated to the film.
const FALLBACK_STILLS = [
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1400&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1400&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1400&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1400&q=80&auto=format&fit=crop",
];

function buildGallery(movie: MovieApiResponse): string[] {
  const real = [movie.largeImage, movie.smallImage, ...(movie.gallery ?? []), ...(movie.backdrops ?? [])];
  const dedupedReal = Array.from(new Set(real.filter(Boolean) as string[]));

  // Only pad with generic stills if the movie has nothing beyond a single poster.
  if (dedupedReal.length > 1) return dedupedReal;

  const start = ((movie.movieId || 0) * 3) % FALLBACK_STILLS.length;
  const picks = Array.from({ length: 3 }, (_, k) => FALLBACK_STILLS[(start + k) % FALLBACK_STILLS.length]);
  return Array.from(new Set([...dedupedReal, ...picks].filter(Boolean) as string[]));
}

function formatDuration(min?: number) {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function MovieDetailCarousel({ movie, onClose }: Props) {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const hoverRef = useRef(false);

  // Build a rich gallery for whatever movie is open (backend or mock).
  const images = useMemo(() => (movie ? buildGallery(movie) : []), [movie]);

  const count = images.length;
  const go = useCallback(
    (dir: number) => setIdx((i) => (count === 0 ? 0 : (i + dir + count) % count)),
    [count]
  );

  // Reset to first slide whenever a new movie opens.
  useEffect(() => setIdx(0), [movie?.movieId]);

  // Keyboard: ← → to navigate, Esc to close.
  useEffect(() => {
    if (!movie) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [movie, go, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!movie) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [movie]);

  // Gentle autoplay, paused on hover.
  useEffect(() => {
    if (!movie || count <= 1) return;
    const id = setInterval(() => { if (!hoverRef.current) go(1); }, 4500);
    return () => clearInterval(id);
  }, [movie, count, go]);

  if (!movie) return null;

  const title = movie.movieNameEnglish || movie.movieNameVn || "Untitled Movie";
  const releaseDate = movie.showTimes?.[0]?.showDate;

  const handleBook = () => {
    onClose();
    navigate(`/showtime/${movie.movieId}`);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-6xl max-h-[92vh] lg:min-h-[600px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] animate-in fade-in zoom-in-95 duration-200"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white/70 backdrop-blur transition-colors hover:bg-black/70 hover:text-white cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* ── Carousel ── */}
        <div
          className="relative bg-black min-h-[260px] lg:min-h-full"
          onMouseEnter={() => (hoverRef.current = true)}
          onMouseLeave={() => (hoverRef.current = false)}
        >
          <div className="relative h-80 lg:h-full w-full overflow-hidden">
            {images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`${title} — ${i + 1}`}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = movie.largeImage; }}
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
                style={{ opacity: i === idx ? 1 : 0 }}
                draggable={false}
              />
            ))}
            {/* Readability gradient */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#0a0a0a]/40" />

            {/* Arrows */}
            {count > 1 && (
              <>
                <button
                  onClick={() => go(-1)}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-all hover:bg-[#FFD700] hover:text-black hover:scale-110 cursor-pointer"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => go(1)}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-all hover:bg-[#FFD700] hover:text-black hover:scale-110 cursor-pointer"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            {/* Counter */}
            {count > 1 && (
              <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur">
                {idx + 1} / {count}
              </span>
            )}

            {/* Dots */}
            {count > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    aria-label={`Go to image ${i + 1}`}
                    className="h-1.5 rounded-full transition-all duration-300 cursor-pointer"
                    style={{
                      width: i === idx ? "22px" : "6px",
                      backgroundColor: i === idx ? "#FFD700" : "rgba(255,255,255,0.45)",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Info ── */}
        <div className="flex flex-col overflow-y-auto p-6 lg:p-7" style={{ maxHeight: "90vh" }}>
          {/* Badges */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#FFD700]">
              {movie.version || "2D"}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-[#FFD700]">
              <Star size={11} fill="#FFD700" /> 9.0
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-white/70">
              <Clock size={11} /> {formatDuration(movie.duration)}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-extrabold leading-tight text-white">{title}</h2>
          {movie.movieNameVn && movie.movieNameVn !== title && (
            <p className="mt-0.5 text-sm text-white/45">{movie.movieNameVn}</p>
          )}

          {/* Genres */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(movie.movieType ?? []).map((g) => (
              <span key={g} className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] uppercase tracking-wide text-white/60">
                {g}
              </span>
            ))}
          </div>

          {/* Synopsis */}
          <p className="mt-4 text-[13.5px] leading-relaxed text-white/70">
            {movie.content || "Movie details will be updated soon."}
          </p>

          {/* Meta */}
          <div className="mt-5 space-y-2.5 border-t border-white/10 pt-4 text-[13px]">
            {movie.director && (
              <div className="flex items-start gap-2.5">
                <Film size={14} className="mt-0.5 shrink-0 text-[#FFD700]/70" />
                <span className="text-white/50">Director:&nbsp;</span>
                <span className="text-white/85">{movie.director}</span>
              </div>
            )}
            {movie.actor && (
              <div className="flex items-start gap-2.5">
                <UserRound size={14} className="mt-0.5 shrink-0 text-[#FFD700]/70" />
                <span className="text-white/50">Cast:&nbsp;</span>
                <span className="text-white/85">{movie.actor}</span>
              </div>
            )}
            {releaseDate && (
              <div className="flex items-start gap-2.5">
                <Calendar size={14} className="mt-0.5 shrink-0 text-[#FFD700]/70" />
                <span className="text-white/50">Showing from:&nbsp;</span>
                <span className="text-white/85">{toDateStr(releaseDate)}</span>
              </div>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={handleBook}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] py-3 text-sm font-bold text-black shadow-[0_0_22px_rgba(255,215,0,0.3)] transition-all hover:brightness-110 hover:scale-[1.02] cursor-pointer"
          >
            <Ticket size={16} /> Book Now
          </button>
        </div>
      </div>
    </div>
  );
}
